import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
  getExploreProfileCropRect,
  prepareExploreProfileMedia,
  type ExploreProfileMediaCrop,
  type ExploreProfileMediaKind,
} from '../../services/exploreSocialService';

type Props = {
  file: File;
  kind: ExploreProfileMediaKind;
  onCancel: () => void;
  onApply: (blob: Blob, crop: ExploreProfileMediaCrop) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function ExploreImageCropModal({ file, kind, onCancel, onApply }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<ExploreProfileMediaCrop>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      imageRef.current = image;
      setReady(true);
    };
    image.onerror = () => setError('이미지를 불러오지 못했습니다.');
    image.src = objectUrl;
    return () => {
      imageRef.current = null;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !ready) return;

    const width = kind === 'avatar' ? 800 : 1200;
    const height = kind === 'avatar' ? 800 : 450;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const rect = getExploreProfileCropRect(image.naturalWidth, image.naturalHeight, kind, crop);
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);
  }, [crop, kind, ready]);

  const moveByPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = dragRef.current;
    if (!previous) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setCrop((current) => ({
      ...current,
      offsetX: clamp(current.offsetX - (dx / rect.width) * 2, -1, 1),
      offsetY: clamp(current.offsetY - (dy / rect.height) * 2, -1, 1),
    }));
  };

  const changeZoom = (value: number) => {
    setCrop((current) => ({ ...current, zoom: clamp(value, 1, 3) }));
  };

  const apply = async () => {
    if (applying || !ready) return;
    setApplying(true);
    setError('');
    try {
      const blob = await prepareExploreProfileMedia(file, kind, crop);
      onApply(blob, crop);
    } catch (reason) {
      console.error('Explore profile crop failed:', reason);
      setError(reason instanceof Error ? reason.message : '이미지 편집에 실패했습니다.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="soridraw-explore-crop-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !applying) onCancel();
    }}>
      <section className="soridraw-explore-crop-modal" role="dialog" aria-modal="true" aria-labelledby="soridraw-crop-title">
        <header className="soridraw-explore-crop-header">
          <h3 id="soridraw-crop-title">{kind === 'avatar' ? '프로필 사진 편집' : '배경 이미지 편집'}</h3>
          <button type="button" onClick={onCancel} disabled={applying} aria-label="닫기"><X aria-hidden="true" /></button>
        </header>

        <div className={`soridraw-explore-crop-stage${kind === 'avatar' ? ' is-avatar' : ' is-background'}`}>
          <canvas
            ref={canvasRef}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerMove={moveByPointer}
            onPointerUp={(event) => {
              dragRef.current = null;
              try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
            }}
            onPointerCancel={() => { dragRef.current = null; }}
            aria-label="이미지 위치 조정"
          />
          {!ready && !error && <div className="soridraw-explore-crop-loading"><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /></div>}
        </div>

        <p className="soridraw-explore-crop-help">이미지를 드래그해 위치를 옮기고 확대/축소해서 맞춰주세요.</p>

        <div className="soridraw-explore-crop-controls">
          <button type="button" onClick={() => changeZoom(crop.zoom - 0.1)} aria-label="축소"><Minus aria-hidden="true" /></button>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={crop.zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            aria-label="이미지 확대 축소"
          />
          <button type="button" onClick={() => changeZoom(crop.zoom + 0.1)} aria-label="확대"><Plus aria-hidden="true" /></button>
          <button
            type="button"
            className="soridraw-explore-crop-reset"
            onClick={() => setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })}
            aria-label="위치와 확대 초기화"
            title="초기화"
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </div>

        {error && <div className="soridraw-explore-profile-edit-error" role="alert">{error}</div>}

        <footer className="soridraw-explore-crop-footer">
          <button type="button" className="is-cancel" onClick={onCancel} disabled={applying}>취소</button>
          <button type="button" className="is-apply" onClick={() => void apply()} disabled={!ready || applying}>
            {applying ? <><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 적용 중</> : '적용'}
          </button>
        </footer>
      </section>
    </div>
  );
}
