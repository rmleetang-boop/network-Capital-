"""
TEMPORARY data-recovery puller.

Usage (after the app is redeployed on Emergent so it can reach the managed Atlas DB):

    python3 /app/backend/scripts/pull_prod_data.py \
        --source-url https://<deployed-host> \
        [--key <DB_RESTORE_KEY>] [--no-drop] [--exclude otps,password_resets]

Pages through every collection exposed by GET /api/admin/db-export on the deployed
app (extended JSON via bson.json_util) and writes them into the LOCAL preview
MongoDB (MONGO_URL/DB_NAME from /app/backend/.env). By default each local
collection is dropped before import so production data replaces seeded data.
"""
import argparse
import os
import sys

import requests
from bson import json_util
from dotenv import dotenv_values
from pymongo import MongoClient

ENV = dotenv_values('/app/backend/.env')
PAGE = 500


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source-url', required=True, help='Base URL of deployed app (no trailing slash)')
    ap.add_argument('--key', default=ENV.get('DB_RESTORE_KEY'), help='DB_RESTORE_KEY value')
    ap.add_argument('--no-drop', action='store_true', help='Do not drop local collections first')
    ap.add_argument('--exclude', default='', help='Comma-separated collection names to skip')
    args = ap.parse_args()

    if not args.key:
        sys.exit('No DB_RESTORE_KEY available')

    base = args.source_url.rstrip('/')
    headers = {'X-Restore-Key': args.key}
    excluded = {c.strip() for c in args.exclude.split(',') if c.strip()}

    r = requests.get(f'{base}/api/admin/db-export/collections', headers=headers, timeout=30)
    r.raise_for_status()
    meta = r.json()
    print(f"Source DB: {meta.get('db_name')}")

    client = MongoClient(ENV['MONGO_URL'].strip('"'))
    local = client[ENV['DB_NAME'].strip('"')]

    grand_total = 0
    for col in meta['collections']:
        name, count = col['name'], col['count']
        if name in excluded:
            print(f"  SKIP {name} ({count})")
            continue
        copied = 0
        skip = 0
        dropped = args.no_drop  # treat as already-dropped when --no-drop
        while skip < count or (skip == 0 and count == 0):
            resp = requests.get(
                f'{base}/api/admin/db-export',
                params={'collection': name, 'skip': skip, 'limit': PAGE},
                headers=headers, timeout=120,
            )
            resp.raise_for_status()
            docs = json_util.loads(resp.text)
            if not docs:
                break
            if not dropped:
                local[name].drop()  # drop only after first remote page is safely in memory
                dropped = True
            local[name].insert_many(docs, ordered=False)
            copied += len(docs)
            skip += PAGE
        grand_total += copied
        print(f"  {name}: {copied}/{count} imported")

    print(f"DONE — {grand_total} documents imported into {ENV['DB_NAME']}")
    print("Restart backend so super-admin bootstrap re-promotes the owner account:")
    print("  sudo supervisorctl restart backend")


if __name__ == '__main__':
    main()
