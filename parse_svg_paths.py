
import json

with open('svg_paths.json', 'r') as f:
    data = json.load(f)

shapes = []

for svg_name, svg_data in data.items():
    shape_key = svg_name.replace('.svg', '')
    if shape_key in ['acne', 'psoriasis']:
        continue
        
    print(f"Found shape: {shape_key}")
    
    # Collect all path d values
    path_ds = []
    for key, value in svg_data.items():
        if isinstance(value, str) and (value.strip().startswith('m') or value.strip().startswith('M')):
            path_ds.append(value)
    
    print(f"  Paths found: {len(path_ds)}")
    if path_ds:
        # Combine all paths into one previewPath
        preview_path = ' '.join(path_ds)
        shapes.append({
            'key': shape_key,
            'label': f'consultation.page.exam.bodyMap.shapes.{shape_key}',
            'previewPath': preview_path
        })

print()
print("LesionShapeTemplateKey type:")
print("type LesionShapeTemplateKey = " + " | ".join([f"'{s['key']}'" for s in shapes]) + ";")
print()
print("LESION_SHAPE_TEMPLATES:")
print("const LESION_SHAPE_TEMPLATES: LesionShapeTemplate[] = [")
for s in shapes:
    print(f"  {{ key: '{s['key']}', label: '{s['label']}', previewPath: '{s['previewPath']}' }},")
print("];")

print()
print("French translations:")
for s in shapes:
    print(f"  '{s['label']}': '{s['key'].capitalize()}',")

print()
print("English translations:")
for s in shapes:
    print(f"  '{s['label']}': '{s['key'].capitalize()}',")

print()
print("Arabic translations (placeholder, need real translations):")
for s in shapes:
    print(f"  '{s['label']}': '{s['key']}',")
