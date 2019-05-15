#!/usr/bin/env python3

#   Copyright 2017 Alex Tucker
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

import re
import string
import traceback

import gspread
from oauth2client.service_account import ServiceAccountCredentials
from sqlobject import *


class Organisation(SQLObject):
    sheetName = UnicodeCol()
    longName = UnicodeCol(default=None)
    link = UnicodeCol()


class Dataset(SQLObject):
    organisation = ForeignKey('Organisation', cascade=True)
    title = UnicodeCol()
    frequency = EnumCol(enumValues=['5Y', '4Y', '3Y', '2Y', 'Y', 'Q', 'M', 'W', '2W', '2', '6', 'AH'])
    frequencyNotes = UnicodeCol()
    link = UnicodeCol()
    status = EnumCol(enumValues=['Official Statistics', 'National Statistics', 'Experimental Statistics', 'OpenData'])
    size = IntCol()


class Stats(SQLObject):
    name = UnicodeCol()
    geography = UnicodeCol()
    time = UnicodeCol()
    unit = UnicodeCol()
    topics = RelatedJoin('Topic')
    metadata = UnicodeCol()
    form = UnicodeCol()
    dataset = ForeignKey('Dataset', cascade=True)
    size = IntCol()


class Topic(SQLObject):
    label = UnicodeCol()


def refresh(log):
    parenthetical = re.compile(r'(.*)\s+\(([^)]*)\)')
    scope = ['https://spreadsheets.google.com/feeds']

    credentials = ServiceAccountCredentials.from_json_keyfile_name('/data/solar-system.json', scope)

    gc = gspread.authorize(credentials)
    sh = gc.open_by_key('1Fiu5q-si5PUvh7ulWwHkQnUoREgYliywZOd7HOftPsU')

    connection = connectionForURI('mysql://solar:system@sqldb/sheet?charset=utf8')
    sqlhub.processConnection = connection

    Organisation.createTable(ifNotExists=True)
    Organisation.deleteMany(None)
    connection.query("ALTER TABLE organisation AUTO_INCREMENT=1")

    Dataset.createTable(ifNotExists=True)
    Dataset.deleteMany(None)
    connection.query("ALTER TABLE dataset AUTO_INCREMENT=1")

    Organisation.sqlmeta.addJoin(MultipleJoin('Dataset', joinMethodName='datasets'))

    Stats.createTable(ifNotExists=True)
    Stats.deleteMany(None)
    connection.query("ALTER TABLE stats AUTO_INCREMENT=1")
    Topic.createTable(ifNotExists=True)
    Topic.deleteMany(None)
    connection.query("ALTER TABLE topic AUTO_INCREMENT=1")

    Dataset.sqlmeta.addJoin(MultipleJoin('Stats', joinMethodName='stats'))

    index = sh.worksheet("Index")
    index_data = index.get_all_values()
    assert index_data[0] == ['Organisation', 'URL']
    orgLongName = {}
    orgId = {}
    for org, url in index_data[1:]:
        persistedOrg = Organisation(sheetName=org, link=url)
        orgId[org] = persistedOrg.id

    topicIds = {}
    log.write_message({"type": "totalSheets", "total": len(sh.worksheets()) - 1})
    for sheet in sh.worksheets()[2:]:
        log.write_message({"type": "processingSheet", "sheet": "%s" % sheet.title})
        data = sheet.get_all_values()
        headers = [header.lower() for header in data[0] if header != '']
        headerCol = {title.lower(): num for num, title in enumerate(data[0]) if title != ''}
        headers = set(headerCol)
        if not {'producer', 'title', 'frequency', 'status'}.issubset(headers):
            log.write_message({
                "type": "warn",
                "msg": "Unexpected header row in sheet %s: %s" % (sheet.title, ', '.join(data[0]))
            })
            continue
        dataset = None
        for row in data[1:]:
            producer = row[headerCol['producer']]
            if producer != '':
                if producer != sheet.title:
                        if sheet.title not in orgLongName:
                            orgLongName[sheet.title] = producer
                            if sheet.title not in orgId:
                                persistedOrg = Organisation(sheetName=sheet.title, link=None)
                                orgId[sheet.title] = persistedOrg.id
                                log.write_message({
                                    "type": "warn",
                                    "msg": "'%s' not in index sheet" % sheet.title})
                            Organisation.get(orgId[sheet.title]).longName = producer
                        elif orgLongName[sheet.title] != producer:
                            log.write_message({
                                "type": "warn",
                                "msg": "Different name for producer, old %s, new %s" % (orgLongName[sheet.title],
                                                                                        producer)})
                frequency = row[headerCol['frequency']] if 'frequency' in headerCol else None
                frequencyNotes = None
                additionalNotesMatch = parenthetical.match(frequency)
                if (additionalNotesMatch):
                    frequency = additionalNotesMatch.group(1)
                    frequencyNotes = additionalNotesMatch.group(2)
                sizeString = row[headerCol['size']] if 'size' in headerCol else None
                size = None
                if sizeString:
                    if sizeString.endswith('kb'):
                        size = int(float(sizeString[:-2].strip()) * 1024)
                    elif sizeString.endswith('MB'):
                        size = int(float(sizeString[:-2].strip()) * 1024 * 1024)
                    else:
                        log.write_message({
                            "type": "warn",
                            "msg": "Unknown size units for '%s'" % sizeString})
                try:
                    dataset = Dataset(organisation=orgId[sheet.title],
                                      title=row[headerCol['title']] if 'title' in headerCol else None,
                                      frequency=frequency,
                                      frequencyNotes=frequencyNotes,
                                      link=row[headerCol['link']] if 'link' in headerCol else None,
                                      status=row[headerCol['status']] if 'status' in headerCol else None,
                                      size=size)
                except:
                    log.write_message({
                        "type": "error",
                        "msg": traceback.format_exc(limit=1)})
                    break
            tableName = row[headerCol['name of table']] if 'name of table' in headerCol else None
            if tableName != '' and tableName != None:
                try:
                    sizeString = row[headerCol['size']] if 'size' in headerCol else None
                    size = None
                    if sizeString:
                        if sizeString.endswith('kb') or sizeString.endswith('KB'):
                            size = int(float(sizeString[:-2].strip()) * 1024)
                        elif sizeString.endswith('MB'):
                            size = int(float(sizeString[:-2].strip()) * 1024 * 1024)
                        else:
                            log.write_message({
                                "type": "warn",
                                "msg": "Unknown size units for '%s'" % sizeString})
                    table = Stats(name=tableName,
                                  geography=row[headerCol['geography']] if 'geography' in headerCol else None,
                                  time=row[headerCol['time period']] if 'time period' in headerCol else None,
                                  unit=row[headerCol['unit of measure']] if 'unit of measure' in headerCol else None,
                                  metadata=row[headerCol['metadata']] if 'metadata' in headerCol else None,
                                  form=row[headerCol['format']] if 'format' in headerCol else None,
                                  dataset=dataset,
                                  size=size)
                    if 'topic dimensions' in headerCol:
                        for topic in row[headerCol['topic dimensions']].split(','):
                            topicLabel = topic.strip().lower()
                            if topicLabel not in topicIds:
                                dbTopic = Topic(label=topicLabel)
                                topicIds[topicLabel] = dbTopic.id
                            else:
                                dbTopic = Topic.get(topicIds[topicLabel])
                            table.addTopic(dbTopic)

                except:
                    log.write_message({
                        "type": "error",
                        "msg": traceback.format_exc(limit=1)})
    log.write_message({"type": "finished"});


if __name__ == "__main__":
    class ConsoleLog:
        def write_message(self, log):
            print(log)
    console = ConsoleLog()
    refresh(console)