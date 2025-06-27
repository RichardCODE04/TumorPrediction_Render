from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
# Configuración mejorada
FLASK_ENV = os.getenv('FLASK_ENV', 'production')  # Cambiar default a 'production'
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# Mejorar CORS
CORS(app, 
    origins=[FRONTEND_URL],
    allow_headers=['Content-Type', 'Authorization'],  # Agregar Authorization por si acaso
    methods=['GET', 'POST', 'OPTIONS'],  # Agregar OPTIONS
    supports_credentials=True  # Si necesitas cookies/auth
)

class_names = ['glioma', 'meningioma', 'notumor', 'pituitary']

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def load_tflite_model():
    model_path = os.path.join('models', 'brain_tumor_cnn.tflite')
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    return interpreter

tflite_interpreter = load_tflite_model()

def predict_image_class(interpreter, img_array):
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    input_index = input_details[0]['index']
    output_index = output_details[0]['index']
    img_array = img_array.astype(np.float32)
    interpreter.set_tensor(input_index, img_array)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_index)
    return output_data[0]

@app.route('/classify', methods=['POST'])
def classify():
    if 'image' not in request.files:
        return jsonify({'error': 'No se envió ninguna imagen'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacío'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    # Preprocesar imagen
    img = image.load_img(filepath, target_size=(128, 128))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0

    # Predicción
    prediction = predict_image_class(tflite_interpreter, img_array)
    predicted_class = class_names[np.argmax(prediction)]
    probabilities = {class_names[i]: float(f"{prob:.4f}") for i, prob in enumerate(prediction)}

    return jsonify({
        'prediction': predicted_class,
        'probabilities': probabilities,
        'image_name': filename
    })
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)