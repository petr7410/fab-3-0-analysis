import os
import sys
import shutil

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

# pyrefly: ignore [missing-import]
from utils.config_loader import load_settings, get_root_dir
# pyrefly: ignore [missing-import]
from data_gathering.draft_parser import parse_draft_file
# pyrefly: ignore [missing-import]
from data_gathering.deck_parser import parse_decks_file
# pyrefly: ignore [missing-import]
from data_processing.card_processor import process_card_database
# pyrefly: ignore [missing-import]
from data_processing.deck_processor import calculate_stats
# pyrefly: ignore [missing-import]
from analysis.data_exporter import export_analysis_data, generate_web_config

def main():
    print("Starting Data Analysis Rework...")
    
    import argparse
    parser = argparse.ArgumentParser(description="Run draft data analysis pipeline.")
    parser.add_argument('--set', type=str, help="Run analysis only for this specific set ID (e.g. OMN)")
    parser.add_argument('--latest', action='store_true', help="Run analysis only for the latest set (first set in settings.json)")
    args = parser.parse_args()
    
    settings = load_settings()
    root = get_root_dir()
    
    global_config = settings['global']
    all_cards_path = os.path.join(root, global_config['all_cards_file'])
    
    sets_to_process = settings['sets']
    
    if args.latest:
        if not sets_to_process:
            print("Error: No sets defined in settings.json.")
            sys.exit(1)
        latest_set_id = list(sets_to_process.keys())[0]
        sets_to_process = {latest_set_id: sets_to_process[latest_set_id]}
        print(f"Option --latest specified. Resolving to latest set: {latest_set_id}")
    elif args.set:
        target_set_id = args.set.upper()
        if target_set_id not in sets_to_process:
            print(f"Error: Set ID '{args.set}' not found in settings.json.")
            print(f"Available sets: {', '.join(sets_to_process.keys())}")
            sys.exit(1)
        sets_to_process = {target_set_id: sets_to_process[target_set_id]}
        print(f"Processing only specified set: {target_set_id}")
    else:
        print("Processing all configured sets.")
        
    for set_id, set_config in sets_to_process.items():
        print(f"\nProcessing set: {set_id} ({set_config['name']})")
        
        # 1. Gathering
        print("   Step 1: Gathering raw data...")
        output_dir = os.path.join(root, 'data', set_id)
        raw_dir = os.path.join(output_dir, 'raw')
        os.makedirs(raw_dir, exist_ok=True)
        
        all_draft_probs = []
        all_custom_cards = []
        
        # Copy draft files to raw/ and parse them
        for draft_info in set_config['draft_files']:
            src_draft_path = os.path.join(root, draft_info['path'])
            dst_draft_path = os.path.join(raw_dir, os.path.basename(draft_info['path']))
            try:
                shutil.copy(src_draft_path, dst_draft_path)
            except Exception as e:
                print(f"      Warning: Could not copy draft file {draft_info['path']}: {e}")
                
            probs, custom_cards = parse_draft_file(src_draft_path)
            all_draft_probs.append(probs)
            all_custom_cards.extend(custom_cards)
            
        # Deduplicate custom cards by name
        unique_custom_cards = {c['name']: c for c in all_custom_cards}.values()
        
        # Copy decks file to raw/ and parse
        src_decks_path = os.path.join(root, set_config['decks_file'])
        dst_decks_path = os.path.join(raw_dir, os.path.basename(set_config['decks_file']))
        try:
            shutil.copy(src_decks_path, dst_decks_path)
        except Exception as e:
            print(f"      Warning: Could not copy decks file {set_config['decks_file']}: {e}")
            
        raw_decks = parse_decks_file(src_decks_path)
        print(f"   Found {len(raw_decks)} decks.")

        # 2. Processing
        print("   Step 2: Processing data...")
        cards_df = process_card_database(
            all_cards_path, 
            unique_custom_cards, 
            global_config['cracked_bauble']
        )
        
        stats_df, heroes_stats, date_stats, processed_decks, deck_count_resp_draft, deck_classifications = calculate_stats(
            raw_decks, 
            cards_df, 
            set_config,
            all_draft_probs
        )
        
        final_df = cards_df.merge(stats_df, left_index=True, right_index=True, how='left')

        # 3. Analysis / Export
        print("   Step 3: Exporting analysis data...")
        export_analysis_data(
            final_df, 
            heroes_stats, 
            date_stats, 
            processed_decks, 
            deck_classifications, 
            set_config, 
            output_dir
        )
        generate_web_config(set_config, heroes_stats, output_dir)
        
        print(f"   Done! Data saved to: {output_dir}")

if __name__ == "__main__":
    main()
