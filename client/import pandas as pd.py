import pandas as pd

# Define the table data
data = {
    'Timestamp': [
        252178.292695848, 252178.302049079, 252178.31205554, 252178.32319254, 252178.332042848
        # Add more timestamp values here
    ],
    'Accel Values': [
        0.0, 0.09696463, -0.79779077, -1.9413323, -2.4226003
        # Add more accel values here
    ]
    # Add more columns and data here if needed
}

# Create a DataFrame from the table data
df = pd.DataFrame(data)

# Convert the DataFrame to a NumPy array
array = df.to_numpy()

print(array)