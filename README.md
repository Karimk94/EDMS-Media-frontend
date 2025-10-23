📚 EDMS Viewer Frontend
This is the frontend application for a modern Electronic Document Management System (EDMS). It's built with Next.js, React, and TypeScript, leveraging Tailwind CSS for a clean, responsive, and customizable user interface.

The application serves as a comprehensive viewer for documents and media, providing a seamless user experience for browsing, searching, and analyzing content.

✨ Features
Responsive Document Grid: A dynamically-loading, paginated grid view that adapts to any screen size.

Intuitive Search: Instantly search documents by title or other metadata.

High-Resolution Viewing: Open documents in a full-screen modal to view high-resolution images.

AI-Powered Face Analysis: Utilize an external service to detect and identify faces within documents.

Abstract Management: Easily update document abstracts with newly identified names, ensuring metadata is always up-to-date.

Seamless Data Flow: The application is designed to automatically refresh content after data updates, ensuring a real-time view of your document library.

🚀 Getting Started
To run this project locally, ensure you have the required backend services running (the EDMS API and the face recognition service).

Clone the repository and install dependencies:

git clone https://github.com/your-username/edms-viewer-frontend.git
cd edms-viewer-frontend
npm install

Start the development server:

npm run dev

Access the application:
Open your browser and navigate to http://localhost:3000.

🌐 API Endpoints
This frontend application communicates with the following backend services, which are assumed to be running on your local machine:

EDMS API: http://127.0.0.1:5000

Face Recognition Service: http://127.0.0.1:5002

Ensure these services are active before running the frontend to avoid connection errors.