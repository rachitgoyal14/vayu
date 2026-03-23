"""
Download all India NCAP AQI CSV files from urbanemissions.info
Run this script from any folder - CSVs will be saved in the same directory.
"""

import os
import time
import urllib.request
import urllib.error
from urllib.parse import quote

# All 277 cities from the website
CITIES = [
    "Agartala", "Agra", "Ahmedabad", "Aizawl", "Ajmer", "Akola", "Alwar",
    "Amaravati", "Ambala", "Amravati", "Amritsar", "Anantapur", "Angul",
    "Ankleshwar", "Araria", "Ariyalur", "Arrah", "Asansol", "Aurangabad",
    "Aurangabad (Bihar)", "Baddi", "Badlapur", "Bagalkot", "Baghpat",
    "Bahadurgarh", "Balasore", "Ballabgarh", "Banswara", "Baran", "Barbil",
    "Bareilly", "Baripada", "Barmer", "Barrackpore", "Bathinda", "Begusarai",
    "Belapur", "Belgaum", "Bengaluru", "Bettiah", "Bhagalpur", "Bharatpur",
    "Bhilai", "Bhilwara", "Bhiwadi", "Bhiwandi", "Bhiwani", "Bhopal",
    "Bhubaneswar", "Bidar", "Bihar Sharif", "Bikaner", "Bilaspur", "Bileipada",
    "Brajrajnagar", "Bulandshahr", "Bundi", "Buxar", "Byasanagar", "Byrnihat",
    "Chamarajanagar", "Chandigarh", "Chandrapur", "Charkhi Dadri", "Chengalpattu",
    "Chennai", "Chhal", "Chhapra", "Chikkaballapur", "Chikkamagaluru", "Chittoor",
    "Chittorgarh", "Churu", "Coimbatore", "Cuddalore", "Cuttack", "Damoh",
    "Darbhanga", "Dausa", "Davanagere", "Dehradun", "Delhi", "Dewas", "Dhanbad",
    "Dharuhera", "Dharwad", "Dholpur", "Dhule", "Dindigul", "Durgapur", "Eloor",
    "Ernakulam", "Faridabad", "Fatehabad", "Firozabad", "Gadag", "GandhiNagar",
    "Gangtok", "Gaya", "Ghaziabad", "Gorakhpur", "Greater Noida", "Gummidipoondi",
    "Gurugram", "Guwahati", "Gwalior", "Hajipur", "Haldia", "Hanumangarh",
    "Hapur", "Hassan", "Haveri", "Hisar", "Hosur", "Howrah", "Hubballi",
    "Hyderabad", "Imphal", "Indore", "Jabalpur", "Jaipur", "Jaisalmer",
    "Jalandhar", "Jalgaon", "Jalna", "Jalore", "Jhalawar", "Jhansi",
    "Jharsuguda", "Jhunjhunu", "Jind", "Jodhpur", "Jorapokhar", "Kadapa",
    "Kaithal", "Kalaburagi", "Kalyan", "Kanchipuram", "Kannur", "Kanpur",
    "Karauli", "Karnal", "Karwar", "Kashipur", "Katihar", "Katni", "Keonjhar",
    "Khanna", "Khurja", "Kishanganj", "Kochi", "Kohima", "Kolar", "Kolhapur",
    "Kolkata", "Kollam", "Koppal", "Korba", "Kota", "Kozhikode", "Kunjemura",
    "Kurukshetra", "Latur", "Loni_Dehat", "Loni_Ghaziabad", "Lucknow",
    "Ludhiana", "Madikeri", "Mahad", "Maihar", "Mandi Gobindgarh", "Mandideep",
    "Mandikhera", "Manesar", "Mangalore", "Manguraha", "Medikeri", "Meerut",
    "Milupara", "Moradabad", "Motihari", "Mumbai", "Munger", "Muzaffarnagar",
    "Muzaffarpur", "Mysuru", "Nagaon", "Nagaur", "Nagpur", "Naharlagun",
    "Nalbari", "Nanded", "Nandesari", "Narnaul", "Nashik", "Navi Mumbai",
    "Nayagarh", "Noida", "Ooty", "Pali", "Palkalaiperur", "Palwal", "Panchkula",
    "Panipat", "Parbhani", "Patiala", "Patna", "Pimpri Chinchwad", "Pithampur",
    "Pratapgarh", "Prayagraj", "Puducherry", "Pune", "Purnia", "Raichur",
    "Raipur", "Rairangpur", "Rajamahendravaram", "Rajgir", "Rajsamand",
    "Ramanagara", "Ramanathapuram", "Ratlam", "Rishikesh", "Rohtak", "Rourkela",
    "Rupnagar", "Sagar", "Saharsa", "Salem", "Samastipur", "Sangli", "Sasaram",
    "Satna", "Sawai Madhopur", "Shillong", "Shivamogga", "Sikar", "Silchar",
    "Siliguri", "Singrauli", "Sirohi", "Sirsa", "Sivasagar", "Siwan", "Solapur",
    "Sonipat", "Sri Ganganagar", "Srinagar", "Suakati", "Surat", "Talcher",
    "Tensa", "Thane", "Thiruvananthapuram", "Thoothukudi", "Thrissur",
    "Tiruchirappalli", "Tirupati", "Tirupur", "Tonk", "Tumakuru", "Tumidih",
    "Udaipur", "Udupi", "Ujjain", "Ulhasnagar", "Vapi", "Varanasi", "Vatva",
    "Vellore", "Vijayapura", "Vijayawada", "Visakhapatnam", "Vrindavan",
    "Yadgir", "Yamunanagar",
]

BASE_URL = "https://urbanemissions.info/wp-content/uploads/ncap/aqibulletins/"
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(SAVE_DIR, exist_ok=True)  # create data/ if it doesn't exist


def download_all():
    total = len(CITIES)
    success, failed = 0, []

    print(f"Saving CSVs to: {SAVE_DIR}")
    print(f"Total cities to download: {total}\n")

    for i, city in enumerate(CITIES, 1):
        filename = f"{city}_AQIBulletins.csv"
        url = BASE_URL + quote(filename)
        save_path = os.path.join(SAVE_DIR, filename)

        # Skip if already downloaded
        if os.path.exists(save_path):
            print(f"[{i:3}/{total}] SKIP  {filename}")
            success += 1
            continue

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            with open(save_path, "wb") as f:
                f.write(data)
            size_kb = len(data) / 1024
            print(f"[{i:3}/{total}] OK    {filename}  ({size_kb:.1f} KB)")
            success += 1
        except urllib.error.HTTPError as e:
            print(f"[{i:3}/{total}] FAIL  {filename}  → HTTP {e.code}")
            failed.append(city)
        except Exception as e:
            print(f"[{i:3}/{total}] FAIL  {filename}  → {e}")
            failed.append(city)

        time.sleep(0.3)  # be polite to the server

    print(f"\n✅ Done - {success}/{total} downloaded successfully.")
    if failed:
        print(f"❌ {len(failed)} failed: {', '.join(failed)}")


if __name__ == "__main__":
    download_all()