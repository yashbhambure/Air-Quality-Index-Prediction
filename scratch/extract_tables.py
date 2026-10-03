import pandas as pd

df = pd.read_csv('dataset/city_day.csv')

print("=== 1. FACTORS AND RANGES ===")
factors = ['PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3', 'CO', 'SO2', 'O3', 'Benzene', 'Toluene', 'Xylene', 'AQI']
for col in factors:
    print(f"| {col} | {df[col].min():.2f} - {df[col].max():.2f} |")

print("\n=== 2. NO OF CITIES AND DATES (YEARLY) ===")
df['Year'] = pd.to_datetime(df['Date']).dt.year
yearly = df.groupby('Year').agg(
    NoOfCities=('City', 'nunique'),
    StartDate=('Date', 'min'),
    EndDate=('Date', 'max')
).reset_index()

for _, r in yearly.iterrows():
    print(f"| {r['NoOfCities']} Cities | {r['StartDate']} to {r['EndDate']} (Year {r['Year']}) |")

print("\n=== 3. NO OF CITIES AND DATES (COHORTS / COMMON DATE RANGES) ===")
city_dates = df.groupby('City')['Date'].agg(StartDate='min', EndDate='max', DaysRecorded='count').reset_index()
city_dates['DateRange'] = city_dates['StartDate'] + " to " + city_dates['EndDate']

cohorts = city_dates.groupby('DateRange').agg(
    NoOfCities=('City', 'count'),
    CityList=('City', lambda x: ', '.join(x)),
    DaysRecorded=('DaysRecorded', 'first')
).reset_index().sort_values('DaysRecorded', ascending=False)

for _, r in cohorts.iterrows():
    print(f"| {r['NoOfCities']} Cities | {r['DateRange']} ({r['CityList']}) |")

print("\n=== 4. EACH CITY AND ITS DATES ===")
for _, r in city_dates.sort_values('City').iterrows():
    print(f"| {r['City']} | {r['StartDate']} to {r['EndDate']} ({r['DaysRecorded']} days) |")
