#!/usr/bin/env python3
import time
from datetime import datetime, timezone
from urllib.parse import urljoin

from dateutil.parser import parse
from cachecontrol import CacheControl
from cachecontrol.caches import FileCache
from cachecontrol.heuristics import LastModified
from requests import Session
from sqlobject import connectionForURI, sqlhub, SQLObject, BoolCol, StringCol, DateTimeCol, SQLObjectNotFound, \
    RelatedJoin, DateCol

connection = connectionForURI('mysql://solar:system@sqldb/ons?charset=utf8')
sqlhub.processConnection = connection


class Dataset(SQLObject):
    uri = StringCol(alternateID=True, length=511)
    national_statistic = BoolCol()
    title = StringCol()
    edition = StringCol()
    summary = StringCol()
    release_date = DateTimeCol()
    next_release = DateCol()
    version = StringCol()
    keywords = RelatedJoin('Keyword')
    contacts = RelatedJoin('Contact')


class Keyword(SQLObject):
    keyword = StringCol(alternateID=True, length=255)


class Contact(SQLObject):
    email = StringCol()
    name = StringCol()
    telephone = StringCol()
    datasets = RelatedJoin('Dataset')


Dataset.createTable(ifNotExists=True)
Keyword.createTable(ifNotExists=True)
Contact.createTable(ifNotExists=True)

s = CacheControl(Session(),
                 cache=FileCache('.cache'),
                 heuristic=LastModified())


def fetch_carefully(url):
    tries = 0
    holdoff = 5
    while tries < 10:
        resp = s.get(url)
        if resp.status_code == 200:
            try:
                return resp.json()
            except:
                pass
        time.sleep(holdoff)
        tries = tries + 1
        holdoff = holdoff * 2


start = 0
limit = 50
still_going = True

while still_going:
    datasets = fetch_carefully(f'https://api.ons.gov.uk/dataset?start={start}&limit={limit}')
    fresh_datasets = False
    for item in datasets['items']:
        ds_uri = urljoin('https://www.ons.gov.uk', item['uri'])
        desc = item['description']
        national_stats = desc.get('nationalStatistic', False)
        release_date = datetime.fromisoformat(desc['releaseDate'].replace('Z', '+00:00')).astimezone(timezone.utc)
        next_release = None
        if 'nextRelease' in desc and desc['nextRelease'] != '':
            try:
                next_release = parse(desc['nextRelease'], fuzzy=True).date()
            except ValueError as e:
                print(e)
        keywords = []
        if 'keywords' in desc:
            for kws in desc['keywords']:  # using a JSON array, but keywords are in a single string with commas
                for kw in kws.split(','):
                    try:
                        record = Keyword.byKeyword(kw.strip())
                        keywords.append(record)
                    except SQLObjectNotFound:
                        keywords.append(Keyword(keyword=kw.strip()))
        contacts = []

        def lift_get_strip(o, k):
            return None if k not in o else None if o[k] == '' else o[k].strip()

        if 'contact' in desc:
            existing_contacts = Contact.selectBy(
                email=lift_get_strip(desc['contact'], 'email'),
                name=lift_get_strip(desc['contact'], 'name'),
                telephone=lift_get_strip(desc['contact'], 'telephone')
            )
            contact = existing_contacts.getOne(None)
            if contact is None:
                contact = Contact(
                    email=lift_get_strip(desc['contact'], 'email'),
                    name=lift_get_strip(desc['contact'], 'name'),
                    telephone=lift_get_strip(desc['contact'], 'telephone')
                )
            contacts.append(contact)
        try:
            ds = Dataset.byUri(ds_uri)
            if ds.release_date != release_date.replace(tzinfo=None):
                fresh_datasets = True
                ds.set(
                    uri=ds_uri,
                    national_statistic=national_stats,
                    title=lift_get_strip(desc, 'title'),
                    edition=lift_get_strip(desc, 'edition'),
                    summary=lift_get_strip(desc, 'summary'),
                    release_date=release_date,
                    next_release=next_release,
                    version=lift_get_strip(desc, 'versionLabel')
                )
                to_add = set(keywords) - set(ds.keywords)
                to_remove = set(ds.keywords) - set(keywords)
                for kw in to_remove:
                    ds.removeKeyword(kw)
                for kw in to_add:
                    ds.addKeyword(kw)
                to_add = set(contacts) - set(ds.contacts)
                to_remove = set(ds.contacts) - set(contacts)
                for contact in to_remove:
                    ds.removeContact(contact)
                for contact in to_add:
                    ds.addContact(contact)
        except SQLObjectNotFound:
            fresh_datasets = True
            ds = Dataset(
                uri=ds_uri,
                national_statistic=national_stats,
                title=lift_get_strip(desc, 'title'),
                edition=lift_get_strip(desc, 'edition'),
                summary=lift_get_strip(desc, 'summary'),
                release_date=release_date,
                next_release=next_release,
                version=lift_get_strip(desc, 'versionLabel')
            )
            for kw in keywords:
                ds.addKeyword(kw)
            for contact in contacts:
                ds.addContact(contact)
    start = start + limit
    if not fresh_datasets or start >= datasets['totalItems']:
        still_going = False
