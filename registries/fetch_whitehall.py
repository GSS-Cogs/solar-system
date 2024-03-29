#!/usr/bin/env python3
import re
import time
from datetime import datetime, timezone

from cachecontrol import CacheControl
from cachecontrol.caches import FileCache
from cachecontrol.heuristics import LastModified
from rdflib import Graph, URIRef, Literal, ConjunctiveGraph
from rdflib.namespace import Namespace, DCTERMS, RDF
from requests import Session
from urllib.parse import urljoin

from sqlobject import connectionForURI, sqlhub, SQLObject, StringCol, DateTimeCol, IntCol, EnumCol, RelatedJoin, \
    SQLObjectNotFound

connection = connectionForURI('mysql://solar:system@sqldb/stats?charset=utf8')
sqlhub.processConnection = connection

DCAT = Namespace('http://www.w3.org/ns/dcat#')
GDP = Namespace('http://gss-data.org.uk/def/gdp#')

s = CacheControl(Session(),
                 cache=FileCache('.cache'),
                 heuristic=LastModified())

orgs = {org['label']['value']: org['org']['value'] for org in s.post(
    'https://staging.gss-data.org.uk/sparql',
    headers={'Accept': 'application/sparql-results+json'},
    data={'query': '''
PREFIX org: <http://www.w3.org/ns/org#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?org ?label
WHERE {
  ?org a org:Organization ;
    rdfs:label ?label .
}'''}).json().get('results', {}).get('bindings', [])}


class Organisation(SQLObject):
    class sqlmeta:
        table = 'wh_organisation'
    uri = StringCol(alternateID=True, length=255)
    label = StringCol()
    datasets = RelatedJoin('Dataset')


class Dataset(SQLObject):
    class sqlmeta:
        table = 'wh_dataset'
    whitehall_id = IntCol(alternateID=True)
    stats_type = EnumCol(enumValues=['Official Statistics', 'National Statistics', 'Statistical data set', None],
                         default=None)
    title = StringCol()
    url = StringCol(alternateID=True, length=255)
    orgs = RelatedJoin('Organisation')
    publication_date = DateTimeCol()
    government_name = StringCol()
    collections = RelatedJoin('Collection')


class Collection(SQLObject):
    class sqlmeta:
        table = 'wh_collection'
    uri = StringCol()
    label = StringCol()
    datasets = RelatedJoin('Dataset')


Organisation.createTable(ifNotExists=True)
Dataset.createTable(ifNotExists=True)
Collection.createTable(ifNotExists=True)


for label, uri in orgs.items():
    try:
        org = Organisation.byUri(uri)
        org.set(label=label)
    except SQLObjectNotFound:
        org = Organisation(uri=uri, label=label)

datasets_url_base = 'https://www.gov.uk/government/statistics.json'
gov_uk_search = 'https://www.gov.uk/api/search.json'

s = CacheControl(Session(),
                 cache=FileCache('.cache'),
                 heuristic=LastModified())
still_going = True

abbr_re = re.compile(r'<abbr title="([^"]+)">')
collection_re = re.compile(r'Part of a collection: <a href="([^"]+)">')


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


while still_going:

    datasets = fetch_carefully(datasets_url)
    fresh_datasets = False
    for res_obj in datasets['results']:
        res = res_obj['result']
        publishers = []
        issued = None
        collection = None
        orgs_list = res['organisations']

        for label, uri in orgs.items():
            if orgs_list.endswith(label) or \
                    f'title="{label}"' in orgs_list or \
                    f'{label} and ' in orgs_list or \
                    f'{label}, ' in orgs_list:
                publishers.append(Organisation.byUri(uri))
        issued = datetime.fromisoformat(res['public_timestamp']).astimezone(timezone.utc)
        if 'publication_collections' in res and res['publication_collections'] is not None:
            coll_match = collection_re.match(res['publication_collections'])
            if coll_match:
                collection = coll_match.group(1)
        landingPage = urljoin(datasets_url, res['url'])
        try:
            ds = Dataset.byUrl(landingPage)
            if ds.publication_date != issued.replace(tzinfo=None) or set(publishers) != set(ds.orgs):
                fresh_datasets = True
                ds.set(
                    whitehall_id=res['id'],
                    stats_type=res['display_type'],
                    title=res['title'],
                    url=landingPage,
                    publication_date=issued,
                    government_name=res['government_name']
                )
                to_add = set(publishers) - set(ds.orgs)
                to_remove = set(ds.orgs) - set(publishers)
                for org in to_remove:
                    ds.removeOrganisation(org)
                for org in to_add:
                    ds.addOrganisation(org)
        except SQLObjectNotFound:
            fresh_datasets = True
            ds = Dataset(
                whitehall_id=res['id'],
                stats_type=res['display_type'],
                title=res['title'],
                url=landingPage,
                publication_date=issued,
                government_name=res['government_name']
            )
            for org in publishers:
                ds.addOrganisation(org)

    if fresh_datasets and 'next_page_url' in datasets:
        datasets_url = urljoin(datasets_url, datasets['next_page_url'])
        still_going = True
    else:
        still_going = False
