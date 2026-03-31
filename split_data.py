import os
import shutil
import random

src = "data/asl_combined"
train_dir = "data/train"
test_dir = "data/test"

os.makedirs(train_dir, exist_ok=True)
os.makedirs(test_dir, exist_ok=True)

for classe in sorted(os.listdir(src)):
    classe_path = os.path.join(src, classe)
    if not os.path.isdir(classe_path):
        continue

    # Collecter toutes les images
    images = []
    for root, dirs, files in os.walk(classe_path):
        # Prendre seulement les dossiers "Input Images"
        if "Input Images" in root or not any(os.path.isdir(os.path.join(classe_path, d)) for d in os.listdir(classe_path)):
            for f in files:
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    images.append(os.path.join(root, f))

    if len(images) == 0:
        print(f"⚠️ {classe}: aucune image trouvée !")
        continue

    random.shuffle(images)
    split = int(0.8 * len(images))

    os.makedirs(os.path.join(train_dir, classe), exist_ok=True)
    os.makedirs(os.path.join(test_dir, classe), exist_ok=True)

    for i, img_path in enumerate(images[:split]):
        ext = os.path.splitext(img_path)[1]
        shutil.copy(img_path, os.path.join(train_dir, classe, f"{i}{ext}"))

    for i, img_path in enumerate(images[split:]):
        ext = os.path.splitext(img_path)[1]
        shutil.copy(img_path, os.path.join(test_dir, classe, f"{i}{ext}"))

    print(f"✅ {classe}: {split} train | {len(images)-split} test")

print("\n🎉 Split terminé !")