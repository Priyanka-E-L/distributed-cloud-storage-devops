import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {

  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  // ============================================
  // LOAD USER FILES
  // ============================================

  useEffect(() => {
    loadUserFiles();
  }, []);

  const loadUserFiles = async () => {

    try {

      const token = localStorage.getItem('token');

      const res = await axios.get(
        'http://localhost:5000/api/files/my-files',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      setFiles(res.data);

    } catch (err) {

      console.error(err);

      setError('Failed to load files');
    }
  };

  // ============================================
  // FILE SELECT
  // ============================================

  const handleFileSelect = (e) => {

    setSelectedFile(e.target.files[0]);
  };

  // ============================================
  // FILE UPLOAD
  // ============================================

  const handleFileUpload = async (e) => {

    e.preventDefault();

    if (!selectedFile) {

      setError('Please select a file');

      return;
    }

    setUploading(true);

    setError('');

    try {

      const formData = new FormData();

      formData.append(
        'file',
        selectedFile
      );

      const token =
        localStorage.getItem('token');

      await axios.post(
        'http://localhost:5000/api/files/upload',
        formData,
        {
          headers: {
            'Content-Type':
              'multipart/form-data',

            'Authorization':
              `Bearer ${token}`
          }
        }
      );

      alert(
        'File uploaded successfully to distributed storage system'
      );

      setSelectedFile(null);

      loadUserFiles();

    } catch (err) {

      console.error(err);

      setError(
        err.response?.data?.message ||
        'Upload failed'
      );

    } finally {

      setUploading(false);
    }
  };

  // ============================================
  // DISTRIBUTED DOWNLOAD
  // ============================================

  const handleDownload = async (
    fileId,
    fileName
  ) => {

    try {

      const token =
        localStorage.getItem('token');

      const response = await axios.get(
        `http://localhost:5000/api/files/download/${fileId}`,
        {
          responseType: 'blob',

          headers: {
            'Authorization':
              `Bearer ${token}`
          }
        }
      );

      // Create download link
      const url =
        window.URL.createObjectURL(
          new Blob([response.data])
        );

      const link =
        document.createElement('a');

      link.href = url;

      link.setAttribute(
        'download',
        fileName
      );

      document.body.appendChild(link);

      link.click();

      link.remove();

    } catch (err) {

      console.error(err);

      alert('Download failed');
    }
  };

  // ============================================
  // DELETE FILE
  // ============================================

  const handleFileDelete = async (fileId) => {

    try {

      const token =
        localStorage.getItem('token');

      await axios.delete(
        `http://localhost:5000/api/files/${fileId}`,
        {
          headers: {
            'Authorization':
              `Bearer ${token}`
          }
        }
      );

      loadUserFiles();

    } catch (err) {

      console.error(err);

      setError(
        'Delete failed: ' +
        (
          err.response?.data?.message ||
          err.message
        )
      );
    }
  };

  // ============================================
  // LOGOUT
  // ============================================

  const handleLogout = () => {

    localStorage.removeItem('token');

    navigate('/');
  };

  // ============================================
  // UI
  // ============================================

  return (

    <div className="dashboard">

      {/* HEADER */}

      <div className="header">

        <h2>
          Cloud Storage Dashboard
        </h2>

        <button onClick={handleLogout}>
          Logout
        </button>

      </div>

      {/* UPLOAD SECTION */}

      <div className="upload-section">

        <h3>
          Upload File
        </h3>

        <form onSubmit={handleFileUpload}>

          <input
            type="file"
            onChange={handleFileSelect}
          />

          <button
            type="submit"
            disabled={uploading}
          >

            {
              uploading
                ? 'Uploading...'
                : 'Upload'
            }

          </button>

        </form>

        {
          error && (
            <div className="error">
              {error}
            </div>
          )
        }

      </div>

      {/* FILES SECTION */}

      <div className="files-section">

        <h3>
          My Files ({files.length})
        </h3>

        {
          files.length === 0 ? (

            <p>
              No files uploaded yet.
            </p>

          ) : (

            <div className="files-list">

              {
                files.map((file) => (

                  <div
                    key={file._id}
                    className="file-item"
                  >

                    {/* FILE INFO */}

                    <div className="file-info">

                      <h4>
                        {file.originalName}
                      </h4>

                      <p>
                        Size:
                        {' '}
                        {(file.size / 1024).toFixed(2)}
                        {' '}
                        KB
                      </p>

                      <p>
                        Type:
                        {' '}
                        {file.fileType}
                      </p>

                      <p>
                        Uploaded:
                        {' '}
                        {
                          new Date(
                            file.uploadDate
                          ).toLocaleString()
                        }
                      </p>

                      {/* DISTRIBUTED INFO */}

                      {
                        file.chunks && (

                          <p>
                            Chunks:
                            {' '}
                            {file.chunks.length}
                          </p>
                        )
                      }

                    </div>

                    {/* ACTIONS */}

                    <div className="file-actions">

                      {
                        file.chunks?.length > 0 ? (

                          <button
                            onClick={() =>
                              handleDownload(
                                file._id,
                                file.originalName
                              )
                            }
                            className="download-btn"
                          >
                            Download
                          </button>

                        ) : (

                          <span
                            style={{
                              color: 'gray'
                            }}
                          >
                            Download N/A
                          </span>

                        )
                      }

                      <button
                        onClick={() =>
                          handleFileDelete(
                            file._id
                          )
                        }
                        className="delete-btn"
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                ))
              }

            </div>
          )
        }

      </div>

    </div>
  );
};

export default Dashboard;