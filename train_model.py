import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import cv2
import numpy as np
import os
import shutil

# ─── Config ───────────────────────────────────────────────
IMG_SIZE    = 64
BATCH_SIZE  = 32
EPOCHS      = 20
DATA_SRC    = "data/asl_combined"
DATA_READY  = "data/asl_ready"
TRAIN_DIR   = "data/train_ready"
VAL_DIR     = "data/val_ready"
MODEL_PATH  = "backend/model/asl_model.h5"

# ─── Preprocessing simple ─────────────────────────────────
def preprocess_image(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return None
    # Juste resize, pas de masque
    result = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    return result

# ─── Étape 1 : Préparer le dataset ───────────────────────
def prepare_dataset():
    print("\n📦 Préparation du dataset...")
    print("=" * 50)

    if os.path.exists(DATA_READY):
        shutil.rmtree(DATA_READY)
    os.makedirs(DATA_READY)

    classes = sorted(os.listdir(DATA_SRC))
    total_ok, total_skip = 0, 0

    for cls in classes:
        cls_src  = os.path.join(DATA_SRC, cls)
        cls_dest = os.path.join(DATA_READY, cls)
        os.makedirs(cls_dest, exist_ok=True)

        images = []
        for root, dirs, files in os.walk(cls_src):
            for f in files:
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    images.append(os.path.join(root, f))

        ok, skip = 0, 0
        for img_path in images:
            img_name  = os.path.basename(img_path)
            dest_path = os.path.join(cls_dest, img_name)

            if os.path.exists(dest_path):
                base, ext = os.path.splitext(img_name)
                dest_path = os.path.join(cls_dest, f"{base}_{ok}{ext}")

            processed = preprocess_image(img_path)
            if processed is not None:
                cv2.imwrite(dest_path, processed)
                ok += 1
            else:
                skip += 1

        icon = "🔢" if cls.isdigit() else "🔤"
        print(f"  {icon} {cls:<10} {ok:>5} images OK | {skip} ignorées")
        total_ok   += ok
        total_skip += skip

    print("=" * 50)
    print(f"✅ Total : {total_ok} images OK | {total_skip} ignorées")

# ─── Étape 2 : Split train / val ─────────────────────────
def split_dataset():
    print("\n✂️  Split train/val (80/20)...")
    print("=" * 50)

    for d in [TRAIN_DIR, VAL_DIR]:
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d)

    classes = sorted(os.listdir(DATA_READY))

    for cls in classes:
        cls_path = os.path.join(DATA_READY, cls)
        images   = os.listdir(cls_path)
        np.random.shuffle(images)

        split      = int(len(images) * 0.8)
        train_imgs = images[:split]
        val_imgs   = images[split:]

        os.makedirs(os.path.join(TRAIN_DIR, cls), exist_ok=True)
        os.makedirs(os.path.join(VAL_DIR,   cls), exist_ok=True)

        for img in train_imgs:
            shutil.copy(os.path.join(cls_path, img),
                        os.path.join(TRAIN_DIR, cls, img))
        for img in val_imgs:
            shutil.copy(os.path.join(cls_path, img),
                        os.path.join(VAL_DIR,   cls, img))

        print(f"  {cls:<10} train={len(train_imgs):>5} | val={len(val_imgs):>5}")

    print("=" * 50)

# ─── Étape 3 : Construire le modèle ──────────────────────
def build_model(num_classes):
    model = models.Sequential([
        layers.Conv2D(32, (3,3), activation='relu',
                      input_shape=(IMG_SIZE, IMG_SIZE, 3)),
        layers.BatchNormalization(),
        layers.MaxPooling2D(2, 2),

        layers.Conv2D(64, (3,3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D(2, 2),

        layers.Conv2D(128, (3,3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D(2, 2),

        layers.Conv2D(256, (3,3), activation='relu'),
        layers.BatchNormalization(),
        layers.GlobalAveragePooling2D(),

        layers.Dense(512, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(num_classes, activation='softmax'),
    ])
    return model

# ─── Étape 4 : Entraîner ─────────────────────────────────
def train():
    print("\n🏋️  Entraînement du modèle...")
    print("=" * 50)

    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=15,
        width_shift_range=0.15,
        height_shift_range=0.15,
        zoom_range=0.2,
        horizontal_flip=True,
        brightness_range=[0.5, 1.5],
        channel_shift_range=30.0,
        fill_mode='nearest'
    )
    val_datagen = ImageDataGenerator(rescale=1./255)

    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical'
    )
    val_gen = val_datagen.flow_from_directory(
        VAL_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical'
    )

    num_classes = len(train_gen.class_indices)
    print(f"📊 Classes     : {num_classes}")
    print(f"📸 Train images: {train_gen.samples}")
    print(f"📸 Val images  : {val_gen.samples}")
    print("=" * 50)

    model = build_model(num_classes)
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            patience=5,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            patience=3,
            factor=0.5,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            MODEL_PATH,
            save_best_only=True,
            verbose=1
        ),
    ]

    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks
    )

    best_val = max(history.history['val_accuracy'])
    print(f"\n🎉 Entraînement terminé !")
    print(f"✅ Meilleure val_accuracy : {best_val*100:.2f}%")
    print(f"💾 Modèle sauvegardé : {MODEL_PATH}")

# ─── Lancer tout ─────────────────────────────────────────
if __name__ == "__main__":
    prepare_dataset()
    split_dataset()
    train()