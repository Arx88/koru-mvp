import os, base64

download_dir = "/home/z/my-project/download"
html_path = os.path.join(download_dir, "auditoria-workingpanel.html")

# Read original HTML
with open(html_path, "r") as f:
    html = f.read()

# Images to inline
images = [
    ("pasted_image_1784151610784.png", "image/png"),
    ("audit-01-2s.png", "image/png"),
    ("audit-02-5s.png", "image/png"),
    ("audit-03-10s.png", "image/png"),
    ("audit-04-20s.png", "image/png"),
]

for filename, mime in images:
    filepath = os.path.join(download_dir, filename)
    if not os.path.exists(filepath):
        print(f"MISSING: {filename}")
        continue
    with open(filepath, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    data_uri = f"data:{mime};base64,{b64}"
    # Replace src="filename" with src="data:..."
    html = html.replace(f'src="{filename}"', f'src="{data_uri}"')
    print(f"Inlined: {filename} ({len(b64)} chars)")

with open(html_path, "w") as f:
    f.write(html)

print(f"\nDone! File size: {os.path.getsize(html_path)} bytes")
