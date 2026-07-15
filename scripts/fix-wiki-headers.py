import re

path = "/home/z/my-project/koru-mvp/src/tools/people/people.ts"
with open(path) as f:
    content = f.read()

# Replace all wiki fetches that have only `signal: AbortSignal.timeout(9000)` arg
# to include `headers: WIKI_HEADERS`
pattern = r'(fetch\(`https://[^`]*wikipedia\.org[^`]*`,\s*\{\s*)signal:\s*AbortSignal\.timeout\(9000\)\s*\}'
replacement = r'\1signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS }'

new_content, count = re.subn(pattern, replacement, content)
print(f"Replaced {count} occurrences")

# Also replace fetch(searchUrl, ...) calls where searchUrl is a Wikipedia URL
pattern2 = r'(fetch\(searchUrl, \{\s*)signal:\s*AbortSignal\.timeout\(9000\)\s*\}'
replacement2 = r'\1signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS }'
new_content, count2 = re.subn(pattern2, replacement2, new_content)
print(f"Replaced {count2} searchUrl occurrences")

with open(path, "w") as f:
    f.write(new_content)
