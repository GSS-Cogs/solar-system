#!/usr/bin/env python3
import time
from datetime import datetime, timezone
from pathlib import PosixPath
from urllib.parse import urljoin, urlparse, urlunparse

from dateutil.parser import parse
from cachecontrol import CacheControl
from cachecontrol.caches import FileCache
from cachecontrol.heuristics import LastModified
from requests import Session
from sqlobject import connectionForURI, sqlhub, SQLObject, BoolCol, StringCol, DateTimeCol, SQLObjectNotFound, \
    RelatedJoin, DateCol

#connection = connectionForURI('mysql://solar:system@sqldb/stats?charset=utf8')
connection = connectionForURI('sqlite:ons')
sqlhub.processConnection = connection


class Dataset(SQLObject):
    class sqlmeta:
        table = 'ons_dataset'
    uri = StringCol(alternateID=True, length=511)
    title = StringCol()
    summary = StringCol()
    keywords = RelatedJoin('Keyword')
    distributions = RelatedJoin('Distribution')


class Distribution(SQLObject):
    class sqlmeta:
        table = 'ons_distribution'
    uri = StringCol()
    national_statistic = BoolCol()
    version = StringCol()
    edition = StringCol()
    release_date = DateTimeCol()
    next_release = DateCol()
    contacts = RelatedJoin('Contact')


class Keyword(SQLObject):
    class sqlmeta:
        table = 'ons_keyword'
    keyword = StringCol(alternateID=True, length=255)


class Contact(SQLObject):
    class sqlmeta:
        table = 'ons_contact'
    email = StringCol()
    name = StringCol()
    telephone = StringCol()
    datasets = RelatedJoin('Distribution')


Dataset.createTable(ifNotExists=True)
Distribution.createTable(ifNotExists=True)
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
    fresh_data = False
    for item in datasets['items']:
        dist_uri = urljoin('https://www.ons.gov.uk', item['uri'])
        dist_parsed = urlparse(dist_uri)
        ds_uri = urlunparse(dist_parsed._replace(path = str(PosixPath(dist_parsed.path).parent)))
        desc = item['description']
        national_stats = desc.get('nationalStatistic', False)
        release_date = datetime.fromisoformat(
            desc['releaseDate'].replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
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
        ds = None
        try:
            ds = Dataset.byUri(ds_uri)
            for attr, existing, told in [('title', ds.title, lift_get_strip(desc, 'title')),
                                         ('summary', ds.summary, lift_get_strip(desc, 'summary'))]:
                if existing != told:
                    print(f"{ds.uri} {attr} changed {existing} => {told}")
                    if existing is None and told is not None:
                        fresh_data = True
                        ds.set(**{attr: told})
        except SQLObjectNotFound:
            ds = Dataset(
                uri=ds_uri,
                title=lift_get_strip(desc, 'title'),
                summary=lift_get_strip(desc, 'summary'))
            fresh_data = True
        to_add = set(keywords) - set(ds.keywords)
        for kw in to_add:
            ds.addKeyword(kw)
            fresh_data = True

        this_dist = None
        for dist in ds.distributions:
            if dist.release_date == release_date and dist.uri == dist_uri: # assume it's the same one
                this_dist = dist
                for attr, existing, told in [('uri', dist.uri, dist_uri),
                                             ('national_statistic', dist.national_statistic, national_stats),
                                             ('version', dist.version, lift_get_strip(desc, 'version')),
                                             ('edition', dist.edition, lift_get_strip(desc, 'edition')),
                                             ('release', dist.release_date, release_date),
                                             ('next_release', dist.next_release, next_release)]:
                    if existing != told:
                        print(f"{dist_uri} {attr} changed {existing} => {told}")
                        if existing is None and told is not None:
                            fresh_data = True
                            dist.set(**{attr: told})
        if this_dist is None:
            this_dist = Distribution(
                uri=dist_uri,
                national_statistic=national_stats,
                edition=lift_get_strip(desc, 'edition'),
                release_date=release_date,
                next_release=next_release,
                version=lift_get_strip(desc, 'versionLabel')
            )
            fresh_data = True
        if this_dist not in ds.distributions:
            ds.addDistribution(this_dist)
            fresh_data = True
        to_add = set(contacts) - set(this_dist.contacts)
        for contact in to_add:
            dist.addContact(contact)

    start = start + limit
    if not fresh_data or start >= datasets['totalItems']:
        still_going = False
