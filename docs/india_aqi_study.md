# The 6 Pollutants Behind India's AQI

> India's Central Pollution Control Board (CPCB) measures air quality using **6 key pollutants**.
> Each pollutant gets its own score called a **sub-index**, and the **final AQI = the worst sub-index among all 6.**
> Think of it like your semester GPA being decided by your worst subject - one bad score pulls everything down.

---

## What Is AQI?

AQI stands for **Air Quality Index**. It is a standardised, dimensionless number on a scale of **0 to 500** that communicates how polluted the air currently is and what the associated health risk is. Instead of reporting raw concentration values in µg/m³ (which most people can't interpret), the AQI converts those values into a single comparable number.

Every country has its own AQI standard. India follows the **National Air Quality Index** defined by CPCB, which is based on 6 pollutants. The US uses a different breakpoint table, Europe uses yet another - so AQI numbers are not directly comparable across countries.

| AQI Range | Category | Health Implication |
|---|---|---|
| 0 – 50 | Good | Minimal impact. Air quality is satisfactory. |
| 51 – 100 | Satisfactory | Minor discomfort for unusually sensitive people. |
| 101 – 200 | Moderate | Breathing discomfort for people with lung/heart disease, children, elderly. |
| 201 – 300 | Poor | Breathing discomfort for most people on prolonged exposure. |
| 301 – 400 | Very Poor | Respiratory illness on prolonged exposure. Affects healthy people too. |
| 401 – 500 | Severe | Serious respiratory and cardiovascular effects even on short exposure. |

---

## The 6 Pollutants

---

### 1. PM2.5 - Fine Particulate Matter

**Full name:** Particulate Matter with aerodynamic diameter less than 2.5 micrometres

**What is it?**

PM2.5 refers to a mixture of solid particles and liquid droplets suspended in air that are smaller than 2.5 micrometres in diameter - roughly 30 times smaller than a human hair. This isn't one specific chemical; it's a category of particles. The composition includes black carbon (soot), sulphates, nitrates, organic compounds, heavy metals, and crustal material depending on the source.

Primary sources: **vehicle exhaust, coal combustion, industrial emissions, crop residue burning (stubble burning in Punjab/Haryana), biomass burning, and construction dust.**

**Why is it the most dangerous pollutant?**

The size is what makes it lethal. Particles larger than 10 µm get trapped in your nose and throat. Particles between 2.5 and 10 µm reach the bronchi. But PM2.5, being smaller than 2.5 µm, bypasses all your body's natural filtration and deposits directly in the alveoli - the tiny air sacs deep in your lungs where gas exchange happens. From there, the smallest particles can even cross into the bloodstream.

Long-term exposure is linked to chronic obstructive pulmonary disease (COPD), lung cancer, cardiovascular disease, and premature death. The WHO estimates PM2.5 pollution kills approximately 7 million people per year globally.

**In India:** PM2.5 is consistently the **dominant pollutant** setting the AQI, particularly in the Indo-Gangetic Plain (Delhi, Lucknow, Patna) during winter. Diwali night PM2.5 in Delhi has been recorded above 900 µg/m³ - 15 times the safe limit in a single night.

**Safe limit (CPCB 24-hour average):** 60 µg/m³  
**Unit:** µg/m³ (micrograms per cubic metre of air)

---

### 2. PM10 - Coarse Particulate Matter

**Full name:** Particulate Matter with aerodynamic diameter less than 10 micrometres

**What is it?**

PM10 includes all particles below 10 µm - which means it includes PM2.5 as a subset. The particles in the 2.5–10 µm range (sometimes called coarse PM) are mostly crustal material: dust from roads, construction sites, quarrying, and wind erosion. They are heavier than PM2.5 and settle out of the air faster, which is why they tend to be localised near the source.

Sources: **unpaved roads, construction demolition, open mining, agricultural tilling, and windblown soil.**

**Why is it dangerous?**

PM10 particles are filtered more efficiently by the nose and upper respiratory tract, so they don't penetrate as deep as PM2.5. However, they still cause significant irritation to the upper airways, trigger asthma attacks, and worsen existing respiratory and cardiovascular conditions. For people with no pre-existing conditions, high PM10 causes coughing, sneezing, and eye irritation.

**Dataset note:** In your data, PM10 has a recorded maximum of 999 µg/m³ in some files. This is a sentinel value - CPCB sensor systems use 999 to indicate a missing or erroneous reading. It is not a real measurement. It needs to be replaced with NaN before any analysis.

**Safe limit (CPCB 24-hour average):** 100 µg/m³  
**Unit:** µg/m³

---

### 3. NO2 - Nitrogen Dioxide

**Full name:** Nitrogen Dioxide

**What is it?**

NO2 is a reddish-brown gas with a sharp, biting odour at high concentrations. It belongs to the nitrogen oxides (NOx) family, which includes NO (nitric oxide) and NO2. It is primarily produced during **high-temperature combustion** - when air (which is 78% nitrogen) is burned along with fuel, nitrogen and oxygen combine to form NOx.

Major sources: **internal combustion engines (petrol and diesel vehicles), thermal power plants, industrial boilers, and aircraft engines.**

**Why is it dangerous?**

At the cellular level, NO2 reacts with moisture in the lungs to form nitric and nitrous acids, which cause oxidative damage to lung tissue. Repeated exposure leads to chronic inflammation of the airways, reduced lung function, and increased susceptibility to respiratory infections like pneumonia. Children exposed to elevated NO2 show measurably reduced lung development.

NO2 is also a precursor to ground-level ozone - in the presence of sunlight, it reacts with volatile organic compounds (VOCs) to produce O3. So controlling NO2 is important not just directly but also to limit secondary ozone formation.

Additionally, NOx contributes to **acid rain** and **particulate formation** when NO2 reacts with ammonia and other compounds in the atmosphere to form fine nitrate particles (a component of PM2.5).

**Safe limit (CPCB 24-hour average):** 80 µg/m³  
**Unit:** µg/m³

---

### 4. SO2 - Sulphur Dioxide

**Full name:** Sulphur Dioxide

**What is it?**

SO2 is a colourless gas with a strong, pungent smell - the same smell you get near a burning matchstick. It is produced when fuels containing sulphur are burned. Coal, which contains 0.5–4% sulphur depending on the grade, releases SO2 when combusted. Diesel fuel also contains sulphur, though Indian regulations have progressively reduced permitted sulphur content.

Major sources: **coal-fired thermal power plants (the single biggest contributor in India), diesel generators, oil refineries, and metal smelting operations.**

**Why is it dangerous?**

SO2 is highly soluble in water, so it dissolves in the mucous membranes of the nose and throat almost immediately. Even brief exposure to elevated concentrations causes bronchoconstriction - the airways tighten, making it harder to breathe. People with asthma are particularly sensitive and can have attacks triggered at concentrations that don't affect healthy people at all.

At the environmental level, SO2 oxidises in the atmosphere to form sulphate particles (SO4²⁻), which become part of PM2.5. It also dissolves in rainwater to form sulphuric acid (H2SO4), causing acid rain that damages ecosystems, corrodes buildings (notably the Taj Mahal has been affected), and acidifies soil and water bodies.

**In India:** The states of Chhattisgarh, Odisha, and Jharkhand - which host large clusters of thermal power plants - have significantly higher SO2 concentrations than major metros.

**Safe limit (CPCB 24-hour average):** 80 µg/m³  
**Unit:** µg/m³

---

### 5. CO - Carbon Monoxide

**Full name:** Carbon Monoxide

**What is it?**

CO is a colourless, odourless, tasteless gas - you cannot detect it with any human sense. It is produced by the **incomplete combustion** of carbon-containing fuels. When fuel burns with sufficient oxygen, carbon fully oxidises to CO2. When oxygen is limited, the reaction stops at CO instead.

Major sources: **petrol and diesel vehicles (especially older engines without catalytic converters), two-stroke engines, coal and wood burning, industrial processes, and cooking on biomass stoves** (a significant source in rural India).

**Why is it the most acutely toxic pollutant?**

Haemoglobin - the protein in red blood cells that carries oxygen - binds to CO with an affinity approximately **240 times greater** than its affinity for O2. When you inhale CO, haemoglobin preferentially picks up CO over oxygen, forming carboxyhaemoglobin (COHb). The result is that your blood physically cannot carry oxygen to your tissues even if you're breathing normally.

At 200 ppm: headache and dizziness within 2–3 hours.  
At 800 ppm: headache, dizziness, convulsions within 45 minutes. Death within 2–3 hours.  
At 12,800 ppm: immediately dangerous to life.

CO poisoning accounts for thousands of accidental deaths every year globally, mostly from running combustion engines or heating appliances in enclosed spaces.

**Dataset note:** CO is measured in **mg/m³**, not µg/m³ like the other pollutants. This is because CO ambient concentrations are much higher (safe limit is 2 mg/m³ = 2,000 µg/m³). If you see CO values like 0.5 or 1.2 in your dataset, those are in mg/m³ - do not compare them numerically with PM2.5 values.

**Safe limit (CPCB 8-hour average):** 2 mg/m³  
**Unit:** mg/m³

---

### 6. O3 - Ground-Level Ozone

**Full name:** Tropospheric (Ground-Level) Ozone

**What is it?**

Ozone is a molecule made of three oxygen atoms (O3). In the stratosphere (15–35 km above Earth), ozone is beneficial - it absorbs harmful UV radiation. Ground-level ozone is an entirely different story. It is **not directly emitted by any source** - it is a secondary pollutant, formed through a series of photochemical reactions in the atmosphere.

The simplified reaction chain:  
NO2 + sunlight → NO + O (atomic oxygen)  
O + O2 → O3 (ozone)

The rate of formation depends on: concentration of NO2 and VOCs (volatile organic compounds), intensity of sunlight, and temperature. This is why ozone is primarily a **daytime and summer pollutant**, peaking in the afternoon when solar radiation is strongest, and is worse on hot sunny days than on cloudy or cold days.

Major precursor sources: **vehicle exhaust (NOx and VOCs), solvent use, industrial emissions, and fuel evaporation.**

**Why is it dangerous?**

Ozone is a powerful oxidising agent. When inhaled, it reacts directly with biological tissue in the lungs, causing oxidative damage to cell membranes and proteins. Effects include chest pain, throat irritation, coughing, and reduced lung function. Long-term exposure is associated with development of asthma and accelerated decline of lung function with age.

Ozone also damages crops - it is estimated to reduce yields of wheat, rice, and soybean significantly across South Asia, which has direct food security implications.

**In India:** Ground-level ozone tends to be worse in **southern cities** like Hyderabad, Bengaluru, and Chennai - which have intense sunlight year-round - and in **summer months** across the country. It is less of a Delhi-in-winter problem and more of a pan-India summer problem.

**Safe limit (CPCB 8-hour average):** 100 µg/m³  
**Unit:** µg/m³

---

## How the AQI Is Actually Calculated - Official CPCB Methodology

### Step 1 - Compute Sub-indices from Concentration Values

Each pollutant's measured concentration is converted into a sub-index using a linear interpolation formula applied to health breakpoint concentration ranges defined by CPCB.

**Averaging window:**
- PM2.5, PM10, NO2, SO2, NH3: **24-hour average**
- CO and O3: **8-hour average** (because these gases act faster on the body)

**The formula:**

```
Sub-index (Ip) = ((IHi - ILo) / (BHi - BLo)) x (Cp - BLo) + ILo

Where:
  Cp  = measured concentration of the pollutant
  BLo = lower concentration breakpoint <= Cp
  BHi = upper concentration breakpoint >= Cp
  ILo = AQI value corresponding to BLo
  IHi = AQI value corresponding to BHi
```

**Example breakpoint table for PM2.5:**

| Concentration (µg/m³) | AQI Sub-index |
|---|---|
| 0 – 30 | 0 – 50 |
| 30 – 60 | 51 – 100 |
| 60 – 90 | 101 – 200 |
| 90 – 120 | 201 – 300 |
| 120 – 250 | 301 – 400 |
| 250 – 500 | 401 – 500 |

So if PM2.5 is measured at 75 µg/m³, it falls in the 60–90 bracket mapping to AQI 101–200. Plugging in:

```
Ip = ((200 - 101) / (90 - 60)) x (75 - 60) + 101
   = (99 / 30) x 15 + 101
   = 49.5 + 101
   = 150.5  →  AQI sub-index for PM2.5 = 151 (Moderate)
```

The same calculation is done for all pollutants available at that station. Then:

```
Final AQI = MAX(IP_PM2.5, IP_PM10, IP_NO2, IP_SO2, IP_CO, IP_O3, ...)
```

The pollutant with the highest sub-index is called the **prominent pollutant** - it is the one driving the AQI at that location on that day. In your AQI Bulletin files, the `Prominent Pollutant` column captures exactly this.

---

### Step 2 - Minimum Data Requirements for a Valid AQI

Not all 8 pollutants are monitored at every station. CPCB defines strict minimum requirements before an AQI can be reported:

- Data must be available for **at least 3 pollutants** at a location.
- Out of those 3, **at least one must be either PM2.5 or PM10**. AQI cannot be computed without particulate data.
- If these conditions are not met, the data is marked **insufficient** and no AQI is reported for that location.
- For each individual sub-index calculation, a **minimum of 16 hours of data** within the averaging window is required. If a station has more than 8 hours of missing data in a 24-hour window, the sub-index for that pollutant is not computed.

**Why this matters for your dataset:** This is why many rows in your data have AQI values present but some pollutant columns are NaN - the station reported enough data for an AQI but individual pollutants were below the 16-hour threshold. Do not drop these rows; they are valid AQI records, just with incomplete sub-index coverage.

---

### Step 3 - Sub-indices Are Reported Even When AQI Cannot Be

Even if a station fails the minimum requirements for an overall AQI (e.g., only PM2.5 is available), CPCB still computes and publishes the **individual sub-index for whichever pollutants are available**. This gives a partial air quality picture for that location.

For your ML model: if a row has PM2.5 and AQI but no NO2/SO2/CO/O3, that row is still useful for training - the features are just sparser.

---

### Step 4 - Real-Time vs Manual Monitoring

CPCB operates two types of monitoring infrastructure:

**Continuous Ambient Air Quality Monitoring Stations (CAAQMS):**
These are automated stations that capture sensor data in real time without human intervention. The AQI system ingests this data continuously and computes AQI using a **running average** - so the AQI displayed at 6 AM on a given day incorporates readings from 6 AM the previous day up to the current moment. This is what your `Dataset_AQI*.xlsx` files capture - snapshots from live CAAQMS feeds.

**Manual Monitoring Stations:**
At stations without continuous sensors, field technicians collect air samples manually and feed concentration values into a separate AQI calculator tool. These stations produce less frequent readings (typically 24-hour averages twice a week) and have more data gaps. The majority of your `*_AQIBulletins.csv` files originate from this manual pipeline - which is why they are daily averages rather than hourly readings.

**Implication for your model:** The two data sources have different temporal resolutions and reliability profiles. The CAAQMS data (xlsx files) is hourly and more complete. The bulletin data (CSV files) is daily and has more missing values. Mixing them without flagging the source will introduce noise - always keep the `_schema` or `_source` column in your master dataset.

---

## Summary for Your VAYU Dataset

| Pollutant | Column in Data | Present | Key Notes |
|---|---|---|---|
| PM2.5 | `PM2.5` | Yes | Primary AQI driver in most Indian cities |
| PM10 | `PM10` | Yes | Contains 999 sentinels - must be cleaned |
| NO2 | `NO2` | Yes | Good coverage across files |
| SO2 | `SO2` | Yes | Good coverage across files |
| CO | `CO` | Yes | Unit is mg/m³, not µg/m³ - don't mix up |
| O3 | `O3` | Yes | Labelled as `Ozone` in some files - needs standardisation |
| AQI | `AQI` | Yes | Already computed - this is your target variable |

For the ML pipeline:

- **Features (X):** PM2.5, PM10, NO2, SO2, CO, O3
- **Regression target (y):** AQI (numeric, 0–500)
- **Classification target (y):** AQI_category (Good / Satisfactory / Moderate / Poor / Very Poor / Severe)