import json
import os

def load_settings(config_path='config/settings.json'):
    # Get absolute path relative to the root of new_version
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    full_path = os.path.join(root_dir, config_path)
    
    with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_root_dir():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
