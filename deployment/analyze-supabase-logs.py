import csv, json, re, sys
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

csv.field_size_limit(10_000_000)
with open(sys.argv[1], encoding='utf-8-sig', newline='') as source:
    rows = list(csv.DictReader(source))

def template(value):
    value = re.sub(r'[0-9a-f]{8}-[0-9a-f-]{27,}', '<id>', value, flags=re.I)
    value = re.sub(r'\b\d{8,}\b', '<number>', value)
    value = re.sub(r'\b(?:eyJ|sb_secret_|sb_publishable_)[A-Za-z0-9_.-]+', '<redacted>', value)
    return value[:220]

def groups(items, key, count=20):
    return Counter(key(row) for row in items).most_common(count)

dates = sorted(row['timestamp'] for row in rows)
summary = {
    'rows': len(rows), 'startUTC': dates[0], 'endUTC': dates[-1],
    'types': groups(rows, lambda r: r['log_type']),
    'statuses': groups(rows, lambda r: (r['log_type'], r['status'])),
    'paths': groups(rows, lambda r: (r['method'], re.sub(r'[0-9a-f-]{36}', '<id>', r['pathname']))),
    'events': groups(rows, lambda r: template(r['event_message'])),
    'minutes': groups(rows, lambda r: (r['timestamp'][:16], r['log_type']), 40),
    'metadataShapes': {},
}
for kind in set(row['log_type'] for row in rows):
    candidates = [r for r in rows if r['log_type'] == kind and r['logs'] != '[]']
    if candidates:
        try:
            value = json.loads(candidates[0]['logs'])
            summary['metadataShapes'][kind] = list(value[0]) if isinstance(value, list) and value else list(value)
        except (ValueError, TypeError):
            summary['metadataShapes'][kind] = 'unparsed'
request_shapes = {}
for row in rows:
    parts = row['event_message'].split(' | ')
    if row['log_type'] != 'edge' or len(parts) < 4:
        continue
    parsed = urlparse(parts[2])
    select = parse_qs(parsed.query).get('select', [''])[0]
    family = 'Edge' if 'Edg/' in parts[3] else 'Node' if parts[3] == 'node' else 'Chromium' if 'Chrome/' in parts[3] else 'Other'
    key = (row['method'], parsed.path, select, family)
    group = request_shapes.setdefault(key, {'count': 0, 'times': []})
    group['count'] += 1
    group['times'].append(row['timestamp'])
shapes = []
for key, group in sorted(request_shapes.items(), key=lambda pair: pair[1]['count'], reverse=True):
    times = sorted(group['times'])
    shapes.append({'method': key[0], 'path': key[1], 'select': key[2], 'agent': key[3], 'count': group['count'], 'firstUTC': times[0], 'lastUTC': times[-1]})
summary['requestShapes'] = [shape for shape in shapes if shape['method'] == 'GET'][:19]
summary.pop('minutes')
summary.pop('events')
summary['cronRoutineRows'] = sum(row['event_message'].startswith('cron job 1 starting:') or row['event_message'].startswith('cron job 1 completed:') for row in rows)
summary['bytesAvailable'] = any(row['logs'] not in ('[]', '', 'null') for row in rows)
summary['oldQueriesAfterFinalRelease'] = Counter(row['pathname'] for row in rows if row['timestamp'] >= '2026-10-04T22:59:22.150000' and row['method'] == 'GET' and 'select=*' in row['event_message'])
print(json.dumps(summary, indent=2))
