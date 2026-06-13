import pandas as pd
from collections import Counter
from datetime import datetime
import numpy as np
from data_processing.card_processor import is_playable_by_hero

def find_highest_index_and_update_corrections(values, correction_list, index):
    """
    Returns index coresponding to the highest value after applzing corrections, but maximally index.
    Updates to correction_list for indexs higher then index.
    Note: This is used to determine, which draft file was most likely used to create the deck and updates correction_list for all draft files, that were not released by the time deck was published
    """
    highest_value = values[0]
    highest_index = 0

    for j in range(1, index + 1):
        current_value = values[j]
        correction = correction_list[j][highest_index]
        if current_value + correction > highest_value:
            highest_value = current_value
            highest_index = j

    for j in range(index + 1, len(values)):
        correction_list[j][highest_index] = max(correction_list[j][highest_index], values[j] - values[highest_index])

    return highest_index

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), '%Y-%m-%d %H:%M:%S')
    except ValueError:
        try:
            return datetime.fromisoformat(date_str.strip())
        except ValueError:
            return None

def is_date_in_range(deck_date, start_date_str, end_date_str):
    if not deck_date:
        return True
    
    start_date = parse_date(start_date_str)
    end_date = parse_date(end_date_str)
    
    if start_date and deck_date < start_date:
        return False
    if end_date and deck_date > end_date:
        return False
    return True

def calculate_stats(decks, cards_df, set_config, draft_probs):
    """
    Calculate comprehensive pick rates and card statistics from deck data.
    
    PHASES:
    1. Filter decks by date range and then classify draft file for each deck by correction-based highest-index matching.
    2. For each deck, filter playable cards per hero config, count main deck and equipment cards, and accumulate hero-specific totals.
    3. Compute total counts, averages per deck, normalized averages (to 30-card decks), and pick rates using draft occurrence probabilities.
    4. Calculate hero-specific pick rates and final weighted average across all heroes.
    
    RETURNS:
    stats_df : DataFrame with card-level statistics (total_count, average_per_deck, normalized_average, draft_average_occurrence#, pick_rate, hero_*_pick_rate, weighted_pick_rate)
    class_dict : dict {hero_name: number_of_decks} counting decks per hero after filtering
    date_dict : dict {hero_name: list_of_tuples} each tuple is (year, month, day) of deck dates
    processed_decks_out : list of dicts with keys [deck_id, hero, date, cards, equips] containing expanded card lists
    deck_count_resp_draft : dict {"all": [counts_per_draft], hero: [counts_per_draft]} decks assigned to each draft period
    deck_classifications : list of dicts mapping each deck_id to hero, date, and assigned_draft_index

    Note: this function is a mess, it should be  ideal to refactor it, in the future.
    """
    heroes = list(set_config["heroes"].keys())
    weapons = set_config.get("weapons", [])
    
    # Filter decks globally by date range
    date_range = set_config.get("date_range", {"start_date": "", "end_date": ""})
    start_date_str = date_range.get("start_date", "")
    end_date_str = date_range.get("end_date", "")
    
    filtered_decks = []
    for d in decks:
        deck_date = None
        if d["date"]:
            try:
                deck_date = datetime.fromisoformat(d["date"])
            except ValueError:
                pass
        
        if is_date_in_range(deck_date, start_date_str, end_date_str):
            filtered_decks.append(d)

    # Assign IDs
    for idx, d in enumerate(filtered_decks):
        d["deck_id"] = idx

    # Classify decks into draft periods
    num_drafts = len(draft_probs)
    # Draft cutoff dates (dates associated with each draft file)
    draft_cutoffs = []
    for df_info in set_config["draft_files"]:
        draft_cutoffs.append(parse_date(df_info["date"]))
        
    deck_draft = [[] for _ in range(num_drafts)]
    for deck in filtered_decks:
        deck_date = None
        if deck["date"]:
            deck_date = datetime.fromisoformat(deck["date"])
            
        assigned = False
        for i in range(num_drafts - 1):
            cutoff = draft_cutoffs[i + 1]
            if cutoff and deck_date and deck_date <= cutoff:
                deck_draft[i].append(deck)
                assigned = True
                break
        if not assigned:
            deck_draft[num_drafts - 1].append(deck)

    # Run correction classifier to get deck_count_resp_draft
    threshold_list = [[float(0)] * i for i in range(num_drafts)]
    deck_count_resp_draft = {"all": [0] * num_drafts}
    for hero in heroes:
        deck_count_resp_draft[hero] = [0] * num_drafts
        
    deck_classifications = []
    for j in range(num_drafts):
        for deck in deck_draft[j]:
            draft_file_average = [0] * num_drafts
            # Combine normal cards
            for count, name in deck["cards"]:
                if name == "Cracked Bauble (yellow)":
                    continue
                for i in range(num_drafts):
                    draft_file_average[i] += draft_probs[i].get(name, 0) * count
            # Combine equipment
            for count, name in deck["equips"]:
                if name not in weapons:
                    for i in range(num_drafts):
                        draft_file_average[i] += draft_probs[i].get(name, 0) * count
                        
            index = find_highest_index_and_update_corrections(draft_file_average, threshold_list, j)
            deck_count_resp_draft["all"][index] += 1
            if deck["hero"] in deck_count_resp_draft:
                deck_count_resp_draft[deck["hero"]][index] += 1

            deck_classifications.append({
                "deck_id": deck["deck_id"],
                "hero": deck["hero"],
                "date": deck["date"],
                "assigned_draft_index": index + 1
            })

    # Initialize count structures
    class_dict = Counter() # Hero -> count of decks
    card_counts = Counter() # Card -> total count
    hero_card_counts = {hero: Counter() for hero in heroes} # Hero -> Card -> count
    date_dict = {hero: [] for hero in heroes} # Hero -> list of dates
    
    # Normalized cards count
    normalized_cards = {"all": Counter()}
    for hero in heroes:
        normalized_cards[hero] = Counter()

    processed_decks_out = []
    
    for deck in filtered_decks:
        hero = deck["hero"]
        if hero not in heroes:
            continue
            
        class_dict[hero] += 1
        
        # Track dates
        if deck["date"]:
            dt = datetime.fromisoformat(deck["date"])
            date_dict[hero].append((dt.year, dt.month, dt.day))
            
        deck_cards = []
        deck_equips = []
        hero_config = set_config["heroes"][hero]
        
        # Filter playable main deck cards
        playable_cards = []
        for count, name in deck["cards"]:
            if name in cards_df.index:
                if is_playable_by_hero(cards_df.loc[name], hero_config):
                    playable_cards.append((count, name))
                    
        # Main deck cards counting
        main_deck_size = sum(count for count, _ in playable_cards)
        for count, name in playable_cards:
            card_counts[name] += count
            hero_card_counts[hero][name] += count
            for _ in range(count):
                deck_cards.append(name)
                    
        # Main deck normalization contribution
        if main_deck_size > 0:
            for count, name in playable_cards:
                contrib = (count / main_deck_size) * 30
                normalized_cards[hero][name] += contrib
                normalized_cards["all"][name] += contrib

        # Equipment cards (exclude weapons)
        for count, name in deck["equips"]:
            if name in cards_df.index and name not in weapons:
                if is_playable_by_hero(cards_df.loc[name], hero_config):
                    card_counts[name] += count
                    hero_card_counts[hero][name] += count
                    for _ in range(count):
                        deck_equips.append(name)

        processed_decks_out.append({
            "deck_id": deck["deck_id"],
            "hero": hero,
            "date": deck["date"],
            "cards": deck_cards,
            "equips": deck_equips
        })

    # Prepare complete card statistics dataframe
    stats_df = pd.DataFrame(index=cards_df.index)
    total_decks = sum(class_dict.values())
    
    stats_df["total_count"] = stats_df.index.map(card_counts).fillna(0)
    stats_df["average_count_per_deck"] = stats_df["total_count"] / total_decks if total_decks > 0 else 0
    stats_df["average_count_per_normalized_deck"] = stats_df.index.map(normalized_cards["all"]).fillna(0) / total_decks if total_decks > 0 else 0

    # Add draft average occurrences
    for i in range(num_drafts):
        stats_df[f"draft_average_occurrence{i+1}"] = stats_df.index.map(draft_probs[i]).fillna(0)

    # Calculate global pick rate
    sum_of_products = sum(
        stats_df[f"draft_average_occurrence{i+1}"] * deck_count_resp_draft["all"][i]
        for i in range(num_drafts)
    )
    # Avoid division by zero
    stats_df["pick_rate"] = (stats_df["total_count"] / sum_of_products).replace([np.inf, -np.inf], 0).fillna(0)

    # Hero specific stats
    for hero in heroes:
        hero_decks_count = class_dict[hero]
        stats_df[f"{hero}_total_count"] = stats_df.index.map(hero_card_counts[hero]).fillna(0)
        
        if hero_decks_count > 0:
            stats_df[f"{hero}_average_count_per_deck"] = stats_df[f"{hero}_total_count"] / hero_decks_count
            stats_df[f"{hero}_average_count_per_normalized_deck"] = stats_df.index.map(normalized_cards[hero]).fillna(0) / hero_decks_count
        else:
            stats_df[f"{hero}_average_count_per_deck"] = 0
            stats_df[f"{hero}_average_count_per_normalized_deck"] = 0
            
        sum_of_products_hero = sum(
            stats_df[f"draft_average_occurrence{i+1}"] * deck_count_resp_draft[hero][i]
            for i in range(num_drafts)
        )
        stats_df[f"{hero}_pick_rate"] = (stats_df[f"{hero}_total_count"] / sum_of_products_hero).replace([np.inf, -np.inf], 0).fillna(0)

    # Weighted pick rate (mean of all hero pick rates)
    hero_pick_rate_cols = [f"{hero}_pick_rate" for hero in heroes]
    stats_df["weighted_pick_rate"] = stats_df[hero_pick_rate_cols].mean(axis=1)

    return stats_df, dict(class_dict), date_dict, processed_decks_out, deck_count_resp_draft, deck_classifications
