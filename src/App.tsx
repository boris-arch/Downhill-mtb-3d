/**
 * Downhill MTB 3D - First Person Downhill Mountain Biking Simulator
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BikeCustomization, CameraView, GameState, TelemetryData, TrackData } from './types/game';
import { DEFAULT_BIKE } from './data/bikeParts';
import { TRACKS } from './data/tracks';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { GarageModal } from './components/GarageModal';
import { TrackSelectModal } from './components/TrackSelectModal';
import { FinishModal } from './components/FinishModal';
import { PauseModal } from './components/PauseModal';
import { soundEngine } from './audio/soundEngine';
import { MTBPhysics, PlayerControls } from './game/physicsEngine';

export default function App() {
  const [bikeConfig, setBikeConfig] = useState<BikeCustomization>(DEFAULT_BIKE);
  const [currentTrack, setCurrentTrack] = useState<TrackData>(TRACKS[0]);
  const [gameState, setGameState] = useState<GameState>('RACING');
  const [cameraView, setCameraView] = useState<CameraView>('first_person_helmet');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControlsHint, setShowControlsHint] = useState<boolean>(true);

  // Modals
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);
  const [isTrackSelectOpen, setIsTrackSelectOpen] = useState<boolean>(false);

  // Physics & Control references
  const physicsRef = useRef<MTBPhysics | null>(null);
  const controlsRef = useRef<PlayerControls>({
    pedal: false,
    brake: false,
    frontBrake: false,
    steerLeft: false,
    steerRight: false,
    bunnyHop: false,
    tuck: false,
    leanBack: false,
    pump: false,
    whipLeft: false,
    whipRight: false,
  });

  // Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    speedKmh: 0,
    speedMph: 0,
    rpm: 0,
    gear: 4,
    maxGear: 7,
    cadence: 0,
    elevation: 380,
    elevationDrop: 0,
    gradePercentage: 18,
    frontForkTravelPercent: 0.15,
    rearShockTravelPercent: 0.20,
    gForce: 1.0,
    leanAngleDeg: 0,
    isGrounded: true,
    airTimeSeconds: 0,
    jumpCount: 0,
    distanceCoveredMeters: 0,
    totalDistanceMeters: 1450,
    progressPercent: 0,
    elapsedTime: 0,
    currentCheckPoint: 0,
    totalCheckPoints: 4,
    crashState: false,
    score: 0,
    streak: 0,
    stuntName: '',
    surfaceName: 'dirt',
    frontBrakePressure: 0,
    rearBrakePressure: 0,
    driftPercent: 0,
    pumpReady: false,
  });

  // Hide initial instructions after 7 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowControlsHint(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      soundEngine.ensureContext();

      if (e.repeat) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          controlsRef.current.pedal = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controlsRef.current.brake = true;
          break;
        case 'KeyX':
          controlsRef.current.frontBrake = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controlsRef.current.steerLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controlsRef.current.steerRight = true;
          break;
        case 'Space':
          e.preventDefault();
          controlsRef.current.bunnyHop = true;
          break;
        case 'KeyF':
          controlsRef.current.pump = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          controlsRef.current.tuck = true;
          break;
        case 'KeyZ':
          controlsRef.current.leanBack = true;
          break;
        case 'KeyQ':
          controlsRef.current.whipLeft = true;
          break;
        case 'KeyE':
          controlsRef.current.whipRight = true;
          break;
        case 'KeyC':
          cycleCamera();
          break;
        case 'KeyR':
          handleResetTrack();
          break;
        case 'Escape':
          setGameState((prev) => (prev === 'RACING' ? 'PAUSED' : prev === 'PAUSED' ? 'RACING' : prev));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          controlsRef.current.pedal = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controlsRef.current.brake = false;
          break;
        case 'KeyX':
          controlsRef.current.frontBrake = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controlsRef.current.steerLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controlsRef.current.steerRight = false;
          break;
        case 'Space':
          controlsRef.current.bunnyHop = false;
          break;
        case 'KeyF':
          controlsRef.current.pump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          controlsRef.current.tuck = false;
          break;
        case 'KeyZ':
          controlsRef.current.leanBack = false;
          break;
        case 'KeyQ':
          controlsRef.current.whipLeft = false;
          break;
        case 'KeyE':
          controlsRef.current.whipRight = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const cycleCamera = useCallback(() => {
    setCameraView((prev) => {
      if (prev === 'first_person_helmet') return 'first_person_stem';
      if (prev === 'first_person_stem') return 'chase_cam';
      return 'first_person_helmet';
    });
  }, []);

  const handleResetTrack = useCallback(() => {
    if (physicsRef.current) {
      physicsRef.current.reset();
    }
    setGameState('RACING');
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleControlInput = (code: string, pressed: boolean) => {
    soundEngine.ensureContext();
    switch (code) {
      case 'KeyW':
        controlsRef.current.pedal = pressed;
        break;
      case 'KeyS':
        controlsRef.current.brake = pressed;
        break;
      case 'KeyX':
        controlsRef.current.frontBrake = pressed;
        break;
      case 'KeyA':
        controlsRef.current.steerLeft = pressed;
        break;
      case 'KeyD':
        controlsRef.current.steerRight = pressed;
        break;
      case 'Space':
        controlsRef.current.bunnyHop = pressed;
        break;
      case 'KeyF':
        controlsRef.current.pump = pressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        controlsRef.current.tuck = pressed;
        break;
      case 'KeyZ':
        controlsRef.current.leanBack = pressed;
        break;
    }
  };

  return (
    <main
      id="mtb-game-container"
      onClick={() => soundEngine.ensureContext()}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none font-sans"
    >
      {/* 3D WebGL Scene */}
      <GameCanvas
        trackData={currentTrack}
        bikeConfig={bikeConfig}
        cameraView={cameraView}
        isPaused={gameState !== 'RACING'}
        onUpdateTelemetry={setTelemetry}
        onFinishRun={() => setGameState('FINISHED')}
        physicsRef={physicsRef}
        controlsRef={controlsRef}
      />

      {/* Helmet Visor Vignette / Goggle Effect */}
      {cameraView === 'first_person_helmet' && (
        <div
          className="absolute inset-0 pointer-events-none shadow-[inset_0_0_90px_rgba(0,0,0,0.7)] border-t-2 border-b-2 border-black/40"
          style={{
            background: 'radial-gradient(circle, transparent 65%, rgba(15, 23, 42, 0.45) 100%)',
          }}
        />
      )}

      {/* Main Heads-Up Display */}
      {gameState === 'RACING' && (
        <HUD
          telemetry={telemetry}
          cameraView={cameraView}
          onCycleCamera={cycleCamera}
          onResetTrack={handleResetTrack}
          onOpenGarage={() => setIsGarageOpen(true)}
          onPause={() => setGameState('PAUSED')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onControlInput={handleControlInput}
        />
      )}

      {/* Quick Controls Hint Pill */}
      {showControlsHint && gameState === 'RACING' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-5 py-2.5 shadow-2xl flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-mono text-slate-300 pointer-events-none animate-pulse">
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">W</kbd> Pedal
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">S</kbd> Rear Brk
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">X</kbd> Front Brk
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">F</kbd> Pump
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">Space</kbd> Hop
          </div>
          <div className="hidden md:flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">Shift/Z</kbd> Weight Lean
          </div>
        </div>
      )}

      {/* Bike Customization Garage Modal */}
      {isGarageOpen && (
        <GarageModal
          currentBike={bikeConfig}
          onSaveBike={(newBike) => {
            setBikeConfig(newBike);
          }}
          onClose={() => setIsGarageOpen(false)}
        />
      )}

      {/* Trail Head Selector Modal */}
      {isTrackSelectOpen && (
        <TrackSelectModal
          currentTrackId={currentTrack.id}
          onSelectTrack={(t) => {
            setCurrentTrack(t);
            handleResetTrack();
          }}
          onClose={() => setIsTrackSelectOpen(false)}
        />
      )}

      {/* Pause Menu Modal */}
      {gameState === 'PAUSED' && (
        <PauseModal
          onResume={() => setGameState('RACING')}
          onRestart={handleResetTrack}
          onOpenGarage={() => {
            setGameState('RACING');
            setIsGarageOpen(true);
          }}
          onOpenTracks={() => {
            setGameState('RACING');
            setIsTrackSelectOpen(true);
          }}
        />
      )}

      {/* Finish Screen Modal */}
      {gameState === 'FINISHED' && (
        <FinishModal
          telemetry={telemetry}
          track={currentTrack}
          onRestart={handleResetTrack}
          onChangeTrack={() => {
            setGameState('RACING');
            setIsTrackSelectOpen(true);
          }}
          onOpenGarage={() => {
            setGameState('RACING');
            setIsGarageOpen(true);
          }}
        />
      )}
    </main>
  );
}
