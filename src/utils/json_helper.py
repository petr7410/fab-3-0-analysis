import math
import json
import pandas as pd

def clean_nan(obj):
    """
    Recursively replaces NaN/Infinity and pandas NA values with None.
    """
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(x) for x in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif pd.isna(obj):
        return None
    return obj

def save_json_compact(data, file_path):
    """
    Cleans NaNs and saves data to a compact JSON file.
    """
    cleaned_data = clean_nan(data)
    with open(file_path, 'w', encoding='utf-8') as f:
        # Save as a single line/compact format
        json.dump(cleaned_data, f, separators=(',', ':'), ensure_ascii=False)
