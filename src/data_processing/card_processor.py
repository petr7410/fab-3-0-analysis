import pandas as pd

def pitch_to_suffix(pitch):
    if pitch == "1": return " (red)"
    if pitch == "2": return " (yellow)"
    if pitch == "3": return " (blue)"
    return ""

def process_card_database(all_cards_path, custom_cards_list, cracked_bauble_data):
    """
    Merges all_cards.csv with custom cards and applies pitch suffixes.
    """
    # Load external database
    all_cards_df = pd.read_csv(all_cards_path, delimiter='\t', encoding='utf-8', quoting=3)
    if '' in all_cards_df.columns:
        all_cards_df.drop(columns=[''], inplace=True)
        
    # Create searchable index: "Name (color)"
    all_cards_df['Full Name'] = all_cards_df.apply(
        lambda row: f"{row['Name']}{pitch_to_suffix(str(row['Pitch']))}", axis=1
    )
    all_cards_df.set_index('Full Name', inplace=True)

    # Process custom cards from draft files
    custom_cards_df = pd.DataFrame(custom_cards_list).set_index('name')
    
    # Handle image_uris -> image_url conversion
    if 'image_uris' in custom_cards_df.columns:
        custom_cards_df['image_url'] = custom_cards_df['image_uris'].apply(
            lambda x: x.get('en') if isinstance(x, dict) else None
        )
        custom_cards_df.drop(columns=['image_uris'], inplace=True)

    # Add cracked bauble
    custom_cards_df.loc["Cracked Bauble (yellow)"] = cracked_bauble_data

    # Merge
    merged_df = custom_cards_df.merge(all_cards_df, left_index=True, right_index=True, how='inner')
    merged_df.drop(columns=['Name'], inplace=True)
    merged_df.index.name = "Name"
    
    return merged_df

def is_playable_by_hero(card_row, hero_config):
    """
    Checks if a card is playable by a hero based on its types.
    """
    if pd.isna(card_row["Types"]):
        raise ValueError(f"Card {card_row['Name']} has no types.")
        
    card_types = set(card_row["Types"].split(", "))
    allowed = set(hero_config.get("allowed_types", []))
    disallowed = set(hero_config.get("disallowed_types", []))

    # Reject if any disallowed type is present
    if any(dt in card_types for dt in disallowed):
        return False

    # Accept if any allowed type is present
    if any(at in card_types for at in allowed):
        return True

    return False
