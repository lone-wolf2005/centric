"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { apiUpload, getStoredToken } from "@/lib/api";
import { unlockAudio } from "@/lib/audio";
import {
  ScanSignalStatus,
  ScanVideoOverlay,
} from "@/components/ScanFeedbackSignal";
import { createImagePreviewUrl, prepareScanImage } from "@/lib/image-utils";
import type { ScanDetectionResult } from "@/lib/types";

async function submitImage(
  sessionId: number,
  source: File | Blob,
  onResult: (result: ScanDetectionResult) => void,
  setError: (message: string) => void,
  setScanning: (value: boolean) => void,
  setSignal: (status: ScanSignalStatus) => void,
  onPreview: (url: string) => void,
) {
  setScanning(true);
  setError("");
  setSignal(null);

  try {
    const prepared = await prepareScanImage(source);
    const preview = await createImagePreviewUrl(prepared);
    onPreview(preview);

    const formData = new FormData();
    formData.append("image", prepared, prepared.name);

    const result = await apiUpload<ScanDetectionResult>(
      `/scan-sessions/${sessionId}/detect`,
      formData,
      getStoredToken(),
    );

    setSignal(result.feedback);
    onResult(result);
  } catch (uploadError) {
    const message =
      uploadError instanceof Error ? uploadError.message : "Detection failed";
    setError(message);
  } finally {
    setScanning(false);
  }
}

export function CameraScanner({
  sessionId,
  onResult,
}: {
  sessionId: number;
  onResult: (result: ScanDetectionResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [signal, setSignal] = useState<ScanSignalStatus>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [useCameraView, setUseCameraView] = useState(true);

  function updatePreview(url: string) {
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return url;
    });
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        { video: true, audio: false },
      ];

      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              setCameraReady(true);
              setCameraError("");
            };
            await videoRef.current.play();
          }

          return;
        } catch {
          continue;
        }
      }

      setCameraError(
        "Camera unavailable. Upload any image size using the button below.",
      );
      setUseCameraView(false);
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      void startCamera();
    } else {
      setCameraError("Camera not supported. Upload any image size instead.");
      setUseCameraView(false);
    }

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function captureAndDetect() {
    await unlockAudio();

    if (!videoRef.current || !canvasRef.current) {
      setError("Camera not ready yet.");
      return;
    }

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera is still initializing. Wait a moment and try again.");
      return;
    }

    setUseCameraView(true);

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to capture frame.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!blob) {
      setError("Failed to capture frame.");
      return;
    }

    await submitImage(
      sessionId,
      blob,
      onResult,
      setError,
      setScanning,
      setSignal,
      updatePreview,
    );
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await unlockAudio();
    setUseCameraView(false);

    await submitImage(
      sessionId,
      file,
      onResult,
      setError,
      setScanning,
      setSignal,
      updatePreview,
    );
    event.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="relative min-h-[240px] overflow-hidden rounded-2xl border border-slate-300 bg-slate-950">
        {useCameraView && !cameraError ? (
          <>
            <video
              ref={videoRef}
              className="max-h-[70vh] w-full object-contain"
              muted
              playsInline
            />
            <ScanVideoOverlay status={signal} />
          </>
        ) : previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded scan preview"
              className="max-h-[70vh] w-full object-contain"
            />
            <ScanVideoOverlay status={signal} />
          </>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-slate-300">
            {cameraError ?? "Upload an image of any size to scan."}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={captureAndDetect}
          disabled={!cameraReady || scanning}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {scanning ? "Detecting..." : "Scan Item in View"}
        </button>

        <button
          type="button"
          onClick={async () => {
            await unlockAudio();
            fileInputRef.current?.click();
          }}
          disabled={scanning}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Upload Any Image
        </button>

        {previewUrl ? (
          <button
            type="button"
            onClick={() => {
              setUseCameraView(true);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
              }
              setPreviewUrl(null);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Back to Camera
          </button>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        <span className="text-sm text-slate-500">
          Any image size is accepted. Large photos are auto-resized before AI detection.
        </span>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
