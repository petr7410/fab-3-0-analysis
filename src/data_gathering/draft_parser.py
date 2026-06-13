import json
from scipy.stats import hypergeom

def parse_draft_file(file_path):
    """
    Parses a draft file and extracts layout probabilities and card data.
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    cards_draft_raw = ""
    layouts = {}
    sets = {}
    all_sets = {}
    current_section = None
    layout_name = None

    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith('[') and line.endswith(']'):
            current_section = line[1:-1]
        elif current_section == 'CustomCards':
            cards_draft_raw += line + "\n"
        elif current_section == 'Layouts' and line.startswith('- '):
            # Extract layout name and weight: "- LayoutName (Weight)"
            parts = line.split('(')
            if len(parts) == 2:
                layout_name = parts[0].strip()[2:]
                weight = int(parts[1].strip(')'))
                layouts[layout_name] = weight
        elif current_section == 'Layouts' and line[0].isdigit():
            # Extract count and card name: "Count CardName"
            parts = line.split(' ', 1)
            if len(parts) == 2:
                count = int(parts[0])
                card_name = parts[1].strip()
                if layout_name not in sets:
                    sets[layout_name] = []
                sets[layout_name].append((count, card_name))
                if card_name not in all_sets:
                    all_sets[card_name] = []
        elif current_section in all_sets:
            parts = line.split(' ', 1)
            if len(parts) == 2:
                count = int(parts[0])
                card_name = parts[1].strip()
                all_sets[current_section].append((count, card_name))

    # Calculate probabilities
    total_layouts = sum(layouts.values())
    # 24 packs are used during draft (3 packs per player and allwys assuming 8 players)
    layouts_average = {layout: hypergeom.mean(total_layouts, weight, 24) for layout, weight in layouts.items()}

    all_cards_average = {}
    for layout in sets:
        for set_count, card_name in sets[layout]:
            total_cards_in_set = sum(count for count, card in all_sets[card_name])
            cards_average = {card: hypergeom.mean(total_cards_in_set, weight, set_count) for weight, card in all_sets[card_name]}
            
            if layout not in all_cards_average:
                all_cards_average[layout] = {}
            for card, average in cards_average.items():
                all_cards_average[layout][card] = all_cards_average[layout].get(card, 0) + average

    cards_prob_distribution = {}
    for layout, l_avg in layouts_average.items():
        if layout in all_cards_average:
            for card, c_avg in all_cards_average[layout].items():
                cards_prob_distribution[card] = cards_prob_distribution.get(card, 0) + (c_avg * l_avg)
    
    try:
        cards_draft = json.loads(cards_draft_raw)
    except json.JSONDecodeError:
        # Try cleaning trailing commas, as that was a common problem
        import re
        cards_draft_raw = re.sub(r',\s*([\]}])', r'\1', cards_draft_raw)
        cards_draft = json.loads(cards_draft_raw)

    return cards_prob_distribution, cards_draft
