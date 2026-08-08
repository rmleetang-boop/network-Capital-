"""Restore production dump (JSON files extracted from mongodb-viewer ZIP) into local MongoDB.

Usage: python restore_prod_dump.py /tmp/dump_extract
- Merges *_partN.json files into their base collection.
- Converts 24-hex-char string _id back to ObjectId (faithful to prod).
- Drops each target collection before inserting (clean restore).
"""
import json
import os
import re
import sys
from collections import defaultdict

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEX24 = re.compile(r"^[0-9a-f]{24}$")


def fix_id(doc):
    v = doc.get("_id")
    if isinstance(v, str) and HEX24.match(v):
        doc["_id"] = ObjectId(v)
    return doc


def main(dump_dir):
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "test_database")]

    groups = defaultdict(list)
    for fname in sorted(os.listdir(dump_dir)):
        if not fname.endswith(".json"):
            continue
        base = re.sub(r"_part\d+$", "", fname[:-5])
        groups[base].append(os.path.join(dump_dir, fname))

    grand_total = 0
    for coll_name, files in sorted(groups.items()):
        docs = []
        for path in files:
            with open(path) as f:
                data = json.load(f)
            if isinstance(data, list):
                docs.extend(data)
        docs = [fix_id(d) for d in docs]
        db[coll_name].drop()
        if docs:
            for i in range(0, len(docs), 1000):
                db[coll_name].insert_many(docs[i : i + 1000], ordered=False)
        count = db[coll_name].count_documents({})
        grand_total += count
        print(f"{coll_name}: {count}")
    print(f"TOTAL: {grand_total} documents restored into '{db.name}'")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/dump_extract")
