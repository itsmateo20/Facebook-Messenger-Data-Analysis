import json
import os
import re
from collections import Counter
from datetime import timedelta, datetime
from tkinter import Tk, filedialog

import matplotlib.pyplot as plt


def fix_encoding(s):
    """Fix mojibake in Facebook's JSON export (UTF-8 bytes mis-stored as Latin-1)."""
    try:
        return s.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def format_duration(seconds):
    duration = timedelta(seconds=seconds)
    days = duration.days
    hours, remainder = divmod(duration.seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{days} days, {hours} hours, {minutes} minutes, {secs} seconds"


def get_folder_path():
    root = Tk()
    root.withdraw()
    folder_path = filedialog.askdirectory(title="Select Folder")
    root.destroy()
    return folder_path


def load_messages(folder_path):
    messages = []
    for file_name in sorted(os.listdir(folder_path)):
        if file_name.startswith("message_") and file_name.endswith(".json"):
            file_path = os.path.join(folder_path, file_name)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                messages.extend(data.get('messages', []))
            except (json.JSONDecodeError, OSError) as e:
                print(f"Warning: could not read {file_name}: {e}")
    return messages


def analyze(messages):
    total_call_duration = 0
    call_starters = Counter()
    emoji_counter = Counter()
    word_counter = Counter()
    day_counter = Counter()

    # Matches supplementary-plane emojis (e.g. 😀) and common BMP symbols (e.g. ☀)
    emoji_re = re.compile(r'[\U0001F000-\U0010FFFF]|[\u2600-\u27BF]')

    for msg in messages:
        if 'call_duration' in msg:
            total_call_duration += msg['call_duration']
            sender = fix_encoding(msg.get('sender_name', 'Unknown'))
            call_starters[sender] += 1

        content = msg.get('content')
        # Skip system call-log messages when counting words/emojis
        if content and 'call_duration' not in msg:
            content = fix_encoding(content)
            for emoji_char in emoji_re.findall(content):
                emoji_counter[emoji_char] += 1
            for word in re.split(r'\s+', content):
                cleaned = re.sub(r"[.,/#!$%^&*;:{}=\-_`~()]", '', word).lower()
                if cleaned:
                    word_counter[cleaned] += 1

        if 'timestamp_ms' in msg:
            ts = datetime.fromtimestamp(msg['timestamp_ms'] / 1000)
            day_counter[ts.strftime('%A')] += 1

    return {
        'total_call_duration': total_call_duration,
        'top_emojis': emoji_counter.most_common(10),
        'call_starters': call_starters.most_common(),
        'top_words': word_counter.most_common(10),
        'most_active_day': day_counter.most_common(1)[0] if day_counter else ('N/A', 0),
    }


def display_results(results):
    duration_str = format_duration(results['total_call_duration'])
    active_day, active_count = results['most_active_day']

    print(f"\nTotal call duration: {duration_str}")
    print(f"Most active day: {active_day} ({active_count} messages)")

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    fig.suptitle(
        f"Messenger Data Analysis\n"
        f"Total call duration: {duration_str}  |  Most active day: {active_day} ({active_count} messages)",
        fontsize=10,
    )

    # Top words
    if results['top_words']:
        words, counts = zip(*results['top_words'])
        axes[0].barh(list(reversed(words)), list(reversed(counts)), color='steelblue')
    else:
        axes[0].text(0.5, 0.5, 'No data', ha='center', va='center', transform=axes[0].transAxes)
    axes[0].set_title('Top 10 Most Used Words')
    axes[0].set_xlabel('Count')

    # Top emojis
    if results['top_emojis']:
        emojis, counts = zip(*results['top_emojis'])
        axes[1].barh(list(reversed(emojis)), list(reversed(counts)), color='coral')
    else:
        axes[1].text(0.5, 0.5, 'No data', ha='center', va='center', transform=axes[1].transAxes)
    axes[1].set_title('Top 10 Most Used Emojis')
    axes[1].set_xlabel('Count')

    # Calls started per participant
    if results['call_starters']:
        names, counts = zip(*results['call_starters'])
        axes[2].bar(names, counts, color='mediumseagreen')
        plt.setp(axes[2].get_xticklabels(), rotation=15, ha='right')
    else:
        axes[2].text(0.5, 0.5, 'No data', ha='center', va='center', transform=axes[2].transAxes)
    axes[2].set_title('Calls Started per Participant')
    axes[2].set_ylabel('Count')

    plt.tight_layout()
    plt.show()


if __name__ == '__main__':
    folder_path = get_folder_path()
    if not folder_path:
        print("No folder selected. Please run the script again and choose a valid folder.")
    else:
        messages = load_messages(folder_path)
        if not messages:
            print("No messages found in the selected folder.")
        else:
            results = analyze(messages)
            display_results(results)
