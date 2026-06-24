
import re
import json

def parse_path(d_string):
    tokens = re.findall(r'[a-zA-Z]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?', d_string)
    return tokens

def get_path_bounds(d_string):
    tokens = parse_path(d_string)
    i = 0
    current_x = 0
    current_y = 0
    start_x = 0
    start_y = 0
    min_x = float('inf')
    max_x = float('-inf')
    min_y = float('inf')
    max_y = float('-inf')
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            i += 1
        else:
            cmd = tokens[i-1] if i > 0 else ''

        # Process command
        if cmd.lower() == 'm':
            x = float(tokens[i])
            y = float(tokens[i+1])
            if cmd == 'm':
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
            start_x = current_x
            start_y = current_y
            # Update bounds
            min_x = min(min_x, current_x)
            max_x = max(max_x, current_x)
            min_y = min(min_y, current_y)
            max_y = max(max_y, current_y)
            i += 2
        elif cmd.lower() == 'l':
            x = float(tokens[i])
            y = float(tokens[i+1])
            if cmd == 'l':
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
            min_x = min(min_x, current_x)
            max_x = max(max_x, current_x)
            min_y = min(min_y, current_y)
            max_y = max(max_y, current_y)
            i += 2
        elif cmd.lower() == 'c':
            # 6 parameters for cubic bezier
            for j in range(3):
                x = float(tokens[i + j*2])
                y = float(tokens[i + j*2 + 1])
                if cmd == 'c':
                    px = current_x + x
                    py = current_y + y
                else:
                    px = x
                    py = y
                min_x = min(min_x, px)
                max_x = max(max_x, px)
                min_y = min(min_y, py)
                max_y = max(max_y, py)
            # Last point is new current
            x = float(tokens[i + 4])
            y = float(tokens[i + 5])
            if cmd == 'c':
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
            min_x = min(min_x, current_x)
            max_x = max(max_x, current_x)
            min_y = min(min_y, current_y)
            max_y = max(max_y, current_y)
            i += 6
        elif cmd.lower() == 'z':
            current_x = start_x
            current_y = start_y
            i += 1
        else:
            # Skip unknown commands or just increment
            i += 1

    return min_x, min_y, max_x, max_y

def transform_path(d_string, scale_factor, tx, ty):
    tokens = parse_path(d_string)
    result = []
    i = 0
    current_x = 0
    current_y = 0
    start_x = 0
    start_y = 0
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            result.append(t)
            cmd = t
            i += 1
        else:
            cmd = tokens[i-1] if i > 0 else ''

        # Process command
        if cmd.lower() == 'm':
            x = float(tokens[i])
            y = float(tokens[i+1])
            if cmd == 'm':
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
            start_x = current_x
            start_y = current_y
            # Transform
            nx = current_x * scale_factor + tx
            ny = current_y * scale_factor + ty
            result.append(f"{nx:.1f}")
            result.append(f"{ny:.1f}")
            i += 2
        elif cmd.lower() == 'l':
            x = float(tokens[i])
            y = float(tokens[i+1])
            if cmd == 'l':
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
            nx = current_x * scale_factor + tx
            ny = current_y * scale_factor + ty
            result.append(f"{nx:.1f}")
            result.append(f"{ny:.1f}")
            i += 2
        elif cmd.lower() == 'c':
            for j in range(3):
                x = float(tokens[i + j*2])
                y = float(tokens[i + j*2 + 1])
                if cmd == 'c':
                    px = current_x + x
                    py = current_y + y
                else:
                    px = x
                    py = y
                nx = px * scale_factor + tx
                ny = py * scale_factor + ty
                result.append(f"{nx:.1f}")
                result.append(f"{ny:.1f}")
            # Last point
            x = float(tokens[i + 4])
            y = float(tokens[i + 5])
            if cmd == 'c':
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
            i += 6
        elif cmd.lower() == 'z':
            result.append('z')
            current_x = start_x
            current_y = start_y
            i += 1
        else:
            # Skip unknown commands
            i += 1

    return " ".join(result)

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
    combined_d = ""
    for key, value in svg_data.items():
        if isinstance(value, str) and (value.strip().startswith('m') or value.strip().startswith('M')):
            path_ds.append(value)
            combined_d += (" " + value) if combined_d else value

    if len(path_ds) > 0:
        # Get bounds
        min_x, min_y, max_x, max_y = get_path_bounds(combined_d)
        width = max_x - min_x
        height = max_y - min_y
        center_x = min_x + width / 2
        center_y = min_y + height / 2

        # Scale factor
        scale_factor = 5  # Scale to 0-40

        # Translate to center at (20,20)
        tx = 20 - center_x * scale_factor
        ty = 20 - center_y * scale_factor

        transformed_paths = []
        for d in path_ds:
            transformed_paths.append(transform_path(d, scale_factor, tx, ty))

        preview_path = " ".join(transformed_paths)
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
