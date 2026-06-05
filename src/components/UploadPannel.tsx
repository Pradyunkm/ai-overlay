import { useState } from "react";

export default function UploadPanel() {

  // Store selected file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Store original image URL
  const [originalImage, setOriginalImage] = useState("");

  // Store grayscale output URL
  const [grayscaleImage, setGrayscaleImage] = useState("");

  // Loading state
  const [loading, setLoading] = useState(false);


  // =========================================
  // HANDLE FILE SELECTION
  // =========================================
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {

    if (event.target.files) {

      setSelectedFile(event.target.files[0]);
    }
  };


  // =========================================
  // HANDLE IMAGE UPLOAD
  // =========================================
  const handleUpload = async () => {

    // Prevent empty upload
    if (!selectedFile) {

      alert("Please select image");

      return;
    }

    // Enable loading
    setLoading(true);

    // Create form data
    const formData = new FormData();

    // Add file into request
    formData.append("file", selectedFile);


    try {

      // Send image to backend
      const apiBase =
        import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

      const response = await fetch(
        `${apiBase}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      // Convert response into JSON
      const data = await response.json();

      console.log(data);

      // Store image URLs
      setOriginalImage(data.original_image);

      setGrayscaleImage(data.grayscale_output);

    } catch (error) {

      console.error(error);

      alert("Upload failed");
    }

    // Disable loading
    setLoading(false);
  };


  return (

    <div
      style={{
        padding: "30px",
        color: "white",
      }}
    >

      <h1>AI Overlay Detection System</h1>


      {/* File Input */}
      <input
        type="file"
        onChange={handleFileChange}
      />


      {/* Upload Button */}
      <button
        onClick={handleUpload}
        style={{
          marginLeft: "10px",
          padding: "10px 20px",
          cursor: "pointer",
        }}
      >

        {loading ? "Processing..." : "Upload"}

      </button>


      {/* Image Output Section */}
      <div
        style={{
          display: "flex",
          gap: "30px",
          marginTop: "40px",
        }}
      >

        {/* Original Image */}
        <div>

          <h2>Original Image</h2>

          {
            originalImage && (

              <img
                src={originalImage}
                alt="Original"
                width="400"
              />
            )
          }

        </div>


        {/* Grayscale Output */}
        <div>

          <h2>Grayscale Output</h2>

          {
            grayscaleImage && (

              <img
                src={grayscaleImage}
                alt="Grayscale"
                width="400"
              />
            )
          }

        </div>

      </div>

    </div>
  );
}