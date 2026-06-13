import os
import pandas as pd
from collections import Counter
from utils.json_helper import save_json_compact
from data_processing.card_processor import is_playable_by_hero

def export_analysis_data(df, heroes_stats, date_dict, processed_decks, deck_classifications, set_config, output_dir):
    """
    Exports processed intermediate files to CSV format under the 'processed' directory,
    and final web analysis datasets to JSON format under the 'analysis' directory.
    """
    processed_dir = os.path.join(output_dir, 'processed')
    analysis_dir = os.path.join(output_dir, 'analysis')
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(analysis_dir, exist_ok=True)
    
    heroes = list(set_config["heroes"].keys())
    num_drafts = len(set_config["draft_files"])
    
    # ==========================================
    # PART 1: Processed Data Export (CSV Format)
    # ==========================================
    
    # 1. Main cards statistics database
    df.to_csv(os.path.join(processed_dir, 'cards_stats.csv'), encoding='utf-8')
    
    # 2. Decks play counts per hero
    heroes_stats_df = pd.DataFrame(list(heroes_stats.items()), columns=['hero', 'deck_count'])
    heroes_stats_df.to_csv(os.path.join(processed_dir, 'decks_stats.csv'), index=False, encoding='utf-8')
    
    # 3. Decks by date activity
    date_records = []
    for hero, dates in date_dict.items():
        counts = Counter(dates)
        for date_tuple, count in counts.items():
            date_str = f"{date_tuple[0]:04d}-{date_tuple[1]:02d}-{date_tuple[2]:02d}"
            date_records.append({"hero": hero, "date": date_str, "deck_count": count})
    if date_records:
        date_stats_df = pd.DataFrame(date_records).sort_values(by=['hero', 'date'])
    else:
        date_stats_df = pd.DataFrame(columns=['hero', 'date', 'deck_count'])
    date_stats_df.to_csv(os.path.join(processed_dir, 'decks_by_date_counts.csv'), index=False, encoding='utf-8')
    
    # 4. Flat decks content database
    flat_deck_records = []
    for deck in processed_decks:
        deck_id = deck["deck_id"]
        hero = deck["hero"]
        date = deck["date"]
        
        card_counts = Counter(deck["cards"])
        for card_name, count in card_counts.items():
            flat_deck_records.append({
                "deck_id": deck_id,
                "hero": hero,
                "date": date,
                "card_name": card_name,
                "count": count,
                "is_equipment": 0
            })
            
        equip_counts = Counter(deck["equips"])
        for equip_name, count in equip_counts.items():
            flat_deck_records.append({
                "deck_id": deck_id,
                "hero": hero,
                "date": date,
                "card_name": equip_name,
                "count": count,
                "is_equipment": 1
            })
    if flat_deck_records:
        decks_df = pd.DataFrame(flat_deck_records)
    else:
        decks_df = pd.DataFrame(columns=["deck_id", "hero", "date", "card_name", "count", "is_equipment"])
    decks_df.to_csv(os.path.join(processed_dir, 'decks.csv'), index=False, encoding='utf-8')
    
    # 5. Deck draft classifications
    deck_class_df = pd.DataFrame(deck_classifications)
    deck_class_df.to_csv(os.path.join(processed_dir, 'deck_draft_classification.csv'), index=False, encoding='utf-8')
    
    # ==========================================
    # PART 2: Web Analysis Export (Compact JSON)
    # ==========================================
    
    # 1. Global Activity over time
    formatted_date_stats = {}
    for hero, dates in date_dict.items():
        counts = Counter(dates)
        sorted_dates = sorted(counts.keys())
        formatted_date_stats[hero] = [
            [f"{y:04d}-{m:02d}-{d:02d}", counts[(y, m, d)]]
            for y, m, d in sorted_dates
        ]
    save_json_compact(formatted_date_stats, os.path.join(analysis_dir, 'activity_over_time.json'))
    
    # 2. Hero-specific dashboard datasets
    for hero in heroes:
        hero_config = set_config["heroes"][hero]
        # Filter playable cards for this hero
        hero_df = df[df.apply(lambda row: is_playable_by_hero(row, hero_config), axis=1)].copy()
        noequip_df = hero_df[~hero_df["Types"].str.contains("Equipment", na=False, case=False)].copy()
        
        # A. Pitch Distribution (exclude Equipment)
        pitch_grouped = noequip_df.groupby("Pitch").agg({
            f"{hero}_average_count_per_normalized_deck": "sum",
            f"{hero}_pick_rate": "mean",
            f"{hero}_total_count": "sum"
        }).reset_index()
        pitch_grouped.columns = ["pitch", "average_count", "pick_rate", "total_count"]
        pitch_dist = pitch_grouped.round(3).to_dict(orient="records")
        
        # B. Defense Distribution (exclude Equipment)
        # Include None/NaN/empty values as "None"
        noequip_df["Defense"] = noequip_df["Defense"].fillna("None").astype(str).str.strip().replace("", "None")
        def_grouped = noequip_df.groupby("Defense").agg({
            f"{hero}_average_count_per_normalized_deck": "sum",
            f"{hero}_pick_rate": "mean",
            f"{hero}_total_count": "sum"
        }).reset_index()
        def_grouped.columns = ["defense", "average_count", "pick_rate", "total_count"]
        def_dist = def_grouped.round(3).to_dict(orient="records")
        
        # C. Cost Distribution (exclude Equipment)
        # Include None/NaN/empty values as "None"
        noequip_df["Cost"] = noequip_df["Cost"].fillna("None").astype(str).str.strip().replace("", "None")
        cost_grouped = noequip_df.groupby("Cost").agg({
            f"{hero}_average_count_per_normalized_deck": "sum",
            f"{hero}_pick_rate": "mean",
            f"{hero}_total_count": "sum"
        }).reset_index()
        cost_grouped.columns = ["cost", "average_count", "pick_rate", "total_count"]
        cost_dist = cost_grouped.round(3).to_dict(orient="records")
        
        # D. Card type summaries (Attack Action, Reaction, Block, etc.)
        def get_type_summary(filtered_df, filter_fn):
            sub_df = filtered_df[filtered_df.apply(filter_fn, axis=1)]
            avg = float(sub_df[f"{hero}_average_count_per_normalized_deck"].sum())
            tot = int(sub_df[f"{hero}_total_count"].sum())
            return {"average_count": round(avg, 3), "total_count": tot}
            
        summaries = {
            "attack_action": get_type_summary(hero_df, lambda r: "Action" in str(r["Types"]) and "Attack" in str(r["Types"])),
            "non_attack_action": get_type_summary(hero_df, lambda r: "Action" in str(r["Types"]) and "Attack" not in str(r["Types"])),
            "attack_reaction": get_type_summary(hero_df, lambda r: "Attack Reaction" in str(r["Types"])),
            "defense_reaction": get_type_summary(hero_df, lambda r: "Defense Reaction" in str(r["Types"])),
            "block": get_type_summary(hero_df, lambda r: "Block" in str(r["Types"])),
            "instant": get_type_summary(hero_df, lambda r: "Instant" in str(r["Types"])),
        }
        
        # Add class/element individual categories instead of combined "pure_class"
        for c in hero_config.get("allowed_types", []):
            summaries[f"class_{c}"] = get_type_summary(hero_df, lambda r, cls=c: cls in str(r["Types"]) and "Equipment" not in str(r["Types"]))
        
        # E. Card lists
        def get_compact_list(sub_df):
            # Sort by pick rate descending
            sorted_df = sub_df.sort_values(by=f"{hero}_pick_rate", ascending=False)
            records = []
            for name, row in sorted_df.iterrows():
                records.append({
                    "name": name,
                    "average_count_per_deck": round(float(row[f"{hero}_average_count_per_deck"]), 3),
                    "average_count_per_normalized_deck": round(float(row[f"{hero}_average_count_per_normalized_deck"]), 3),
                    "pick_rate": round(float(row[f"{hero}_pick_rate"]), 3),
                    "total_count": int(row[f"{hero}_total_count"]),
                    "rarity": row["rarity"],
                    "types": row["Types"],
                    "keywords": row["Card Keywords"],
                    "image_url": row["image_url"]
                })
            return records
            
        all_cards = get_compact_list(hero_df)
        
        hero_data = {
            "hero": hero,
            "deck_count": heroes_stats.get(hero, 0),
            "pitch_distribution": pitch_dist,
            "defense_distribution": def_dist,
            "cost_distribution": cost_dist,
            "card_type_summaries": summaries,
            "cards": all_cards
        }
        
        save_json_compact(hero_data, os.path.join(analysis_dir, f'hero_{hero.replace(" ", "_")}.json'))
        
    # 3. Global comparison lists
    def get_global_comparison_list(sub_df):
        sorted_df = sub_df.sort_values(by="pick_rate", ascending=False)
        records = []
        for name, row in sorted_df.iterrows():
            record = {
                "name": name,
                "pick_rate": round(float(row["pick_rate"]), 3),
                "weighted_pick_rate": round(float(row["weighted_pick_rate"]), 3),
                "average_count": round(float(row["average_count_per_deck"]), 3),
                "total_count": int(row["total_count"]),
                "rarity": row["rarity"],
                "types": row["Types"],
                "keywords": row["Card Keywords"],
                "image_url": row["image_url"]
            }
            for h in heroes:
                record[f"{h}_pick_rate"] = round(float(row[f"{h}_pick_rate"]), 3)
                record[f"{h}_total_count"] = int(row[f"{h}_total_count"])
            records.append(record)
        return records

    # Equipment comparison
    equip_comp = get_global_comparison_list(df[df["Types"].str.contains("Equipment", na=False, case=False)])
    save_json_compact(equip_comp, os.path.join(analysis_dir, 'equipment_comparison.json'))
    
    # Shared cards comparison (exclude Equipment)
    heroes_config = set_config["heroes"]
    all_allowed_sets = [set(hero["allowed_types"]) for hero in heroes_config.values()]
    shared_allowed_types = set.intersection(*all_allowed_sets) if all_allowed_sets else set()

    all_disallowed_types = set()
    for hero in heroes_config.values():
        all_disallowed_types.update(hero["disallowed_types"])
    all_disallowed_types.update(["Equipment"])

    def matches_criteria(cell_value):
        if pd.isna(cell_value):
            return False

        has_allowed = any(allowed_type in str(cell_value) for allowed_type in shared_allowed_types)
        has_disallowed = any(disallowed_type in str(cell_value) for disallowed_type in all_disallowed_types)
        
        return has_allowed and not has_disallowed

    shared_comp = get_global_comparison_list(df[df["Types"].apply(matches_criteria)])
    save_json_compact(shared_comp, os.path.join(analysis_dir, 'shared_comparison.json'))

    # 4. Draft file occurrence comparison
    draft_records = []
    sorted_draft_df = df.sort_values(by="weighted_pick_rate", ascending=False)
    for name, row in sorted_draft_df.iterrows():
        record = {
            "name": name,
            "weighted_pick_rate": round(float(row["weighted_pick_rate"]), 3),
            "pick_rate": round(float(row["pick_rate"]), 3),
            "total_count": int(row["total_count"]),
            "average_count_per_deck": round(float(row["average_count_per_deck"]), 3),
            "average_count_per_normalized_deck": round(float(row["average_count_per_normalized_deck"]), 3),
            "rarity": row["rarity"],
            "types": row["Types"],
            "keywords": row["Card Keywords"],
            "image_url": row["image_url"]
        }
        for i in range(num_drafts):
            record[f"draft_average_occurrence{i+1}"] = round(float(row[f"draft_average_occurrence{i+1}"]), 3)
        draft_records.append(record)
    save_json_compact(draft_records, os.path.join(analysis_dir, 'draft_file_analysis.json'))

def generate_web_config(set_config, heroes_stats, output_dir):
    """
    Generates a web config file for the JS frontend.
    """
    config = {
        "set_name": set_config.get("name", ""),
        "heroes": list(set_config["heroes"].keys()),
        "hero_color": {hero: details.get("color", "#000000")for hero, details in set_config["heroes"].items()},
        "weapons": set_config.get("weapons", []),
        "total_decks": sum(heroes_stats.values()),
        "hero_deck_counts": heroes_stats,
        "last_updated": pd.Timestamp.now().isoformat()
    }
    analysis_dir = os.path.join(output_dir, 'analysis')
    save_json_compact(config, os.path.join(analysis_dir, 'web_config.json'))
