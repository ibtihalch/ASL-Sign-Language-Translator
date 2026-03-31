import os

data_path = "data/asl_combined"

print("=" * 40)
print(f"{'Classe':<10} {'Nombre d images':>15}")
print("=" * 40)

total = 0
for folder in sorted(os.listdir(data_path)):
    folder_path = os.path.join(data_path, folder)
    if os.path.isdir(folder_path):
        count = len(os.listdir(folder_path))
        total += count
        print(f"{folder:<10} {count:>15}")

print("=" * 40)
print(f"{'TOTAL':<10} {total:>15}")