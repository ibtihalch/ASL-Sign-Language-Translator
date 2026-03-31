import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns

IMG_SIZE = 64
BATCH_SIZE = 32
TEST_DIR = "data/test"

model = tf.keras.models.load_model("model/asl_model.h5")

test_datagen = ImageDataGenerator(rescale=1./255)
test_gen = test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    shuffle=False
)

loss, accuracy = model.evaluate(test_gen)
print(f"\n✅ Accuracy : {accuracy*100:.2f}%")
print(f"✅ Loss     : {loss:.4f}")

y_pred = np.argmax(model.predict(test_gen), axis=1)
y_true = test_gen.classes
class_names = list(test_gen.class_indices.keys())

print("\n📊 Rapport de classification :")
print(classification_report(y_true, y_pred, target_names=class_names))