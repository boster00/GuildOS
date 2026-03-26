'use client';

import { useState } from 'react';
import { initMonkey } from '@/libs/monkey';

export default function TestImageGeneration() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/test-img-gen', { prompt });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to generate image');

      // Add new images to the beginning of the array
      setImages([...data.images, ...images]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateImage();
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          DALL-E 3 Image Generator Test
        </h1>

        {/* Input Section */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Generate Image</h2>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Enter your prompt:</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24 resize-none"
                placeholder="A serene landscape with mountains and a lake at sunset..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <label className="label">
                <span className="label-text-alt">Press Enter to generate or Shift+Enter for new line</span>
              </label>
            </div>

            {error && (
              <div className="alert alert-error mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="card-actions justify-end mt-4">
              <button
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
                onClick={generateImage}
                disabled={loading || !prompt.trim()}
              >
                {loading ? 'Generating...' : 'Generate Image'}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {images.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Generated Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {images.map((image, index) => (
                <div key={index} className="card bg-base-100 shadow-xl">
                  <figure className="px-4 pt-4">
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className="rounded-xl w-full h-auto"
                    />
                  </figure>
                  <div className="card-body">
                    <h3 className="card-title text-sm">Prompt:</h3>
                    <p className="text-sm text-base-content/70">{image.prompt}</p>
                    <div className="card-actions justify-end mt-2">
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        Open in New Tab
                      </a>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          navigator.clipboard.writeText(image.url);
                          alert('URL copied to clipboard!');
                        }}
                      >
                        Copy URL
                      </button>
                    </div>
                    {image.revised_prompt && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-base-content/60">DALL-E Revised Prompt:</h4>
                        <p className="text-xs text-base-content/50 italic">{image.revised_prompt}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">DALL-E 3 Test Page</h3>
            <div className="text-xs">
              This page uses OpenAI's DALL-E 3 model to generate images from text prompts. 
              Images are generated at 1024x1024 resolution and URLs are valid for a limited time.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
