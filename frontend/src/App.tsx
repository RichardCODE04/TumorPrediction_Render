import React, { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { FormEvent } from 'react';
import './App.css';

// Types para la respuesta del backend Flask
interface ClassificationResponse {
  prediction: string;
  probabilities: { [key: string]: number };
  image_name?: string;
}

interface ApiError {
  error: string;
  message?: string;
}

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [probabilities, setProbabilities] = useState<{ [key: string]: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona un archivo de imagen válido');
        return;
      }

      // Validar tamaño (ej: máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo es demasiado grande. Máximo 10MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
      
      // Crear preview de la imagen
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          setPreviewUrl(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault();
    
    if (!selectedFile) {
      setError('Por favor selecciona una imagen');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // Crear FormData para enviar la imagen
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const response = await fetch(`${API_URL}/classify`, {
    method: 'POST',
    body: formData,
  });
      if (response.ok) {
        const data: ClassificationResponse = await response.json();
        setPrediction(data.prediction);
        setProbabilities(data.probabilities);
      } else {
        const errorData: ApiError = await response.json();
        setError(errorData.message || errorData.error || 'Error al clasificar la imagen');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = (): void => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPrediction(null);
    setProbabilities(null);
    setError(null);
  };

  return (
    <div className="app-container">
      <h1 className="title">Clasificador de Imágenes de Resonancia Magnética</h1>

      <div className="upload-form">
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileSelect}
          className="file-input"
          required 
        />
        <br />
        <button 
          onClick={handleSubmit} 
          disabled={isLoading || !selectedFile}
          className={`button ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? 'Clasificando...' : 'Clasificar Imagen'}
        </button>
        {selectedFile && (
          <button 
            onClick={resetForm} 
            className="button reset-button"
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {prediction && (
        <div className="result">
          <strong>Resultado: </strong>{prediction}
        </div>
      )}

      {previewUrl && (
        <div className="preview">
          <img 
            src={previewUrl} 
            alt="Imagen cargada" 
            className="preview-image"
          />
        </div>
      )}

      {probabilities && (
        <div className="probabilities-section">
          <h3>Probabilidades por clase:</h3>
          
          <table className="probabilities-table">
            <thead>
              <tr>
                <th>Clase</th>
                <th>Probabilidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(probabilities)
                .sort(([, a], [, b]) => b - a) // Ordenar por probabilidad descendente
                .map(([clase, prob]) => (
                <tr key={clase}>
                  <td>{clase}</td>
                  <td className={prob > 0.5 ? 'high-probability' : ''}>
                    {(prob * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;