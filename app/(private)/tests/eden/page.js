"use client";

import ChatTester from "./components/ChatTester";
import ImageTester from "./components/ImageTester";
import VideoTester from "./components/VideoTester";
import AudioTester from "./components/AudioTester";
import CapabilityExplorer from "./components/CapabilityExplorer";

export default function EdenTestPage() {
  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="card bg-base-100 shadow-xl mb-6 border border-base-300">
          <div className="card-body">
            <h1 className="card-title text-3xl">Eden AI Test Capability Page</h1>
            <p className="text-base-content/70">
              Testing harness for Eden AI: multi-model chat, image, video, TTS, and capability explorer.
            </p>
          </div>
        </div>
        <ChatTester />
        <ImageTester />
        <VideoTester />
        <CapabilityExplorer />
        <AudioTester />
      </div>
    </div>
  );
}
