import { useState, useEffect, useRef } from 'react';
import { Upload, Image, Clipboard, X, Download, Copy, Move, RotateCcw } from 'lucide-react';

interface ImageItem {
  id: number;
  file: File;
  src: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  zIndex: number;
}

export default function DraggableImageCanvas() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showToast, setShowToast] = useState('');
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [selectedImages, setSelectedImages] = useState(new Set<number>());
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 페이지 로드 시 클립보드 이벤트 리스너 등록
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      e.preventDefault();

      // 클립보드에서 이미지 가져오기
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 이미지 타입인지 확인
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            // 마지막 마우스 위치에 이미지 배치
            await addImage(file, lastMousePos.x, lastMousePos.y);
            showToastMessage('클립보드에서 이미지를 추가했습니다!');
          }
        }
      }
    };

    // 전역 paste 이벤트 리스너 등록
    document.addEventListener('paste', handlePaste);

    // 전역 마우스 이벤트 리스너 (이미지 드래그용)
    const handleMouseMove = (e: MouseEvent) => {
      // 마우스 위치 추적
      setLastMousePos({ x: e.clientX, y: e.clientY });
      if (isDraggingImage && selectedImage) {
        // 줌 레벨을 고려한 드래그 거리 계산
        const deltaX = (e.clientX - dragOffset.x) / zoomLevel;
        const deltaY = (e.clientY - dragOffset.y) / zoomLevel;

        setImages(prev => prev.map(img =>
          img.id === selectedImage
            ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
            : img
        ));

        setDragOffset({ x: e.clientX, y: e.clientY });
      } else if (isDraggingGroup && selectedImages.size > 0) {
        // 줌 레벨을 고려한 그룹 드래그 거리 계산
        const deltaX = (e.clientX - dragOffset.x) / zoomLevel;
        const deltaY = (e.clientY - dragOffset.y) / zoomLevel;

        setImages(prev => prev.map(img =>
          selectedImages.has(img.id)
            ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
            : img
        ));

        setDragOffset({ x: e.clientX, y: e.clientY });
      } else if (isSelecting) {
        // 줌과 팬 오프셋을 고려한 실제 좌표 계산
        const canvasElement = document.querySelector('.min-h-screen') as HTMLElement;
        if (canvasElement) {
          const rect = canvasElement.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          // 마우스 위치를 줌 컨테이너 좌표계로 변환
          const x = (e.clientX - rect.left - centerX) / zoomLevel + centerX - panOffset.x;
          const y = (e.clientY - rect.top - centerY) / zoomLevel + centerY - panOffset.y;

          setSelectionBox(prev => ({
            ...prev,
            endX: x,
            endY: y
          }));
        }
      }
    };

    const handleMouseUp = () => {
      if (isSelecting) {
        // 선택 박스 내의 이미지들 찾기
        const box = {
          left: Math.min(selectionBox.startX, selectionBox.endX),
          right: Math.max(selectionBox.startX, selectionBox.endX),
          top: Math.min(selectionBox.startY, selectionBox.endY),
          bottom: Math.max(selectionBox.startY, selectionBox.endY)
        };

        const selectedIds = new Set<number>();
        images.forEach(img => {
          const imgCenterX = img.x + img.width / 2;
          const imgCenterY = img.y + img.height / 2;

          if (imgCenterX >= box.left && imgCenterX <= box.right &&
            imgCenterY >= box.top && imgCenterY <= box.bottom) {
            selectedIds.add(img.id);
          }
        });

        setSelectedImages(selectedIds);
        setIsSelecting(false);
      }

      setIsDraggingImage(false);
      setIsDraggingGroup(false);
      setSelectedImage(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // 전역 드래그 이벤트 방지 (캔버스 외부에서의 기본 드래그 동작 방지)
    const preventDefaultDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('dragover', preventDefaultDrag);
    document.addEventListener('drop', preventDefaultDrag);

    // 휠 이벤트 리스너 (줌 기능)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const zoomFactor = 0.1;
      const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
      const newZoom = Math.max(0.1, Math.min(3, zoomLevel + delta));

      setZoomLevel(newZoom);
    };

    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dragover', preventDefaultDrag);
      document.removeEventListener('drop', preventDefaultDrag);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isDraggingImage, isDraggingGroup, isSelecting, selectedImage, selectedImages, dragOffset, selectionBox, images, lastMousePos, zoomLevel]);

  const showToastMessage = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(''), 3000);
  };

  const addImage = async (file: File, dropX?: number, dropY?: number) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      // 이미지 로드해서 원본 비율 계산
      const img = new window.Image();
      img.onload = () => {
        const maxSize = 200;
        const aspectRatio = img.width / img.height;

        let width, height;
        if (aspectRatio > 1) {
          // 가로가 더 긴 경우
          width = maxSize;
          height = maxSize / aspectRatio;
        } else {
          // 세로가 더 긴 경우
          width = maxSize * aspectRatio;
          height = maxSize;
        }

        // 드롭 위치가 있으면 그 위치에, 없으면 랜덤 위치에 배치
        let x, y;
        if (dropX !== undefined && dropY !== undefined) {
          // 이미지 중심이 드롭 위치에 오도록 조정
          x = dropX - width / 2;
          y = dropY - height / 2;

          // 화면 경계 체크
          x = Math.max(0, Math.min(x, window.innerWidth - width));
          y = Math.max(100, Math.min(y, window.innerHeight - height - 50)); // 상단 패널 고려
        } else {
          x = Math.random() * (window.innerWidth - width - 100) + 50;
          y = Math.random() * (window.innerHeight - height - 200) + 150;
        }

        const newImage: ImageItem = {
          id: Date.now() + Math.random(),
          file: file,
          src: e.target?.result as string,
          name: file.name || `clipboard-image-${Date.now()}.png`,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toLocaleString('ko-KR'),
          x: x,
          y: y,
          width: width,
          height: height,
          originalWidth: img.width,
          originalHeight: img.height,
          zIndex: Date.now()
        };

        setImages(prev => [...prev, newImage]);
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => addImage(file));
    e.target.value = ''; // input 초기화
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 드래그 상태 초기화
    dragCounterRef.current = 0;
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);

    // 이미지 파일만 필터링
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      showToastMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const dropX = e.clientX;
    const dropY = e.clientY;

    // 여러 파일이 있을 경우 약간씩 위치를 다르게 배치
    imageFiles.forEach((file, index) => {
      const offsetX = dropX + (index * 20);
      const offsetY = dropY + (index * 20);
      addImage(file, offsetX, offsetY);
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 드래그 효과 설정
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleImageMouseDown = (e: React.MouseEvent, imageId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Ctrl 키를 누르고 있으면 다중 선택
    if (e.ctrlKey || e.metaKey) {
      const newSelected = new Set(selectedImages);
      if (newSelected.has(imageId)) {
        newSelected.delete(imageId);
      } else {
        newSelected.add(imageId);
      }
      setSelectedImages(newSelected);
      return;
    }

    // 이미 선택된 이미지들 중 하나를 클릭한 경우 그룹 드래그
    if (selectedImages.has(imageId) && selectedImages.size > 1) {
      setIsDraggingGroup(true);
      setDragOffset({ x: e.clientX, y: e.clientY });

      // 선택된 이미지들을 맨 앞으로
      const now = Date.now();
      setImages(prev => prev.map(img =>
        selectedImages.has(img.id)
          ? { ...img, zIndex: now + img.id }
          : img
      ));
    } else {
      // 단일 이미지 드래그
      setSelectedImage(imageId);
      setSelectedImages(new Set([imageId]));
      setIsDraggingImage(true);
      // 전역 마우스 좌표를 사용하여 일관된 드래그 동작
      setDragOffset({ x: e.clientX, y: e.clientY });

      // 선택된 이미지를 맨 앞으로
      setImages(prev => prev.map(img =>
        img.id === imageId
          ? { ...img, zIndex: Date.now() }
          : img
      ));
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // 이미지가 아닌 빈 공간을 클릭한 경우
    if (e.target === e.currentTarget) {
      setSelectedImages(new Set());
      setIsSelecting(true);

      // 줌과 팬 오프셋을 고려한 실제 좌표 계산
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // 마우스 위치를 줌 컨테이너 좌표계로 변환
      const x = (e.clientX - rect.left - centerX) / zoomLevel + centerX - panOffset.x;
      const y = (e.clientY - rect.top - centerY) / zoomLevel + centerY - panOffset.y;

      setSelectionBox({
        startX: x,
        startY: y,
        endX: x,
        endY: y
      });
    }
  };

  const removeImage = (id: number) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const resetImagePositions = () => {
    setImages(prev => prev.map((img, index) => ({
      ...img,
      x: 50 + (index % 4) * 220,
      y: 50 + Math.floor(index / 4) * 220
    })));
    setSelectedImages(new Set());
    showToastMessage('이미지 위치가 초기화되었습니다!');
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    showToastMessage('줌이 초기화되었습니다!');
  };

  const deleteSelectedImages = () => {
    setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
    setSelectedImages(new Set());
    showToastMessage(`${selectedImages.size}개 이미지가 삭제되었습니다!`);
  };

  const downloadImage = (image: ImageItem) => {
    const link = document.createElement('a');
    link.href = image.src;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyImageToClipboard = async (image: ImageItem) => {
    try {
      // 클립보드 API 지원 확인
      if (!navigator.clipboard || !navigator.clipboard.write) {
        showToastMessage('이 브라우저는 클립보드 복사를 지원하지 않습니다.');
        return;
      }

      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;

          // 원본 이미지 비율 유지
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;

          // 이미지를 캔버스에 그리기
          ctx.drawImage(img, 0, 0);

          // Blob으로 변환
          canvas.toBlob(async (blob) => {
            if (!blob) {
              showToastMessage('이미지 변환에 실패했습니다.');
              return;
            }

            try {
              const clipboardItem = new ClipboardItem({
                [blob.type]: blob
              });

              await navigator.clipboard.write([clipboardItem]);
              showToastMessage('이미지가 클립보드에 복사되었습니다!');
            } catch (clipErr) {
              console.error('클립보드 쓰기 실패:', clipErr);

              // 대안: 이미지 URL을 텍스트로 복사
              try {
                await navigator.clipboard.writeText(image.src);
                showToastMessage('이미지 URL이 클립보드에 복사되었습니다.');
              } catch (textErr) {
                showToastMessage('클립보드 복사에 실패했습니다. HTTPS 환경에서 시도해보세요.');
              }
            }
          }, 'image/png', 1.0);

        } catch (canvasErr) {
          console.error('캔버스 처리 실패:', canvasErr);
          showToastMessage('이미지 처리에 실패했습니다.');
        }
      };

      img.onerror = () => {
        showToastMessage('이미지 로드에 실패했습니다.');
      };

      img.src = image.src;

    } catch (err) {
      console.error('이미지 복사 실패:', err);
      showToastMessage('이미지 복사에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* 상단 컨트롤 패널 */}
      <div className="absolute top-4 left-4 right-4 z-50">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">드래그 가능한 이미지 캔버스</h1>
              <p className="text-white/70">Ctrl+V로 이미지를 추가하고, 드래그해서 자유롭게 배치해보세요!</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                파일 선택
              </button>

              <button
                onClick={resetImagePositions}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                disabled={images.length === 0}
              >
                <RotateCcw className="w-4 h-4" />
                위치 초기화
              </button>

              {selectedImages.size > 0 && (
                <button
                  onClick={deleteSelectedImages}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  선택 삭제 ({selectedImages.size})
                </button>
              )}

              <button
                onClick={resetZoom}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                disabled={zoomLevel === 1}
              >
                🔍 줌 리셋
              </button>

              <div className="bg-white/20 px-4 py-2 rounded-lg flex items-center gap-2">
                <span className="text-white text-sm">줌: {Math.round(zoomLevel * 100)}%</span>
              </div>

              <div className="bg-white/20 px-4 py-2 rounded-lg flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-white" />
                <span className="text-white text-sm">Ctrl+V</span>
              </div>
            </div>
          </div>

          {images.length > 0 && (
            <div className="text-white/70 text-sm">
              이미지 {images.length}개
              {selectedImages.size > 0 && ` • ${selectedImages.size}개 선택됨`}
              • 빈 공간을 드래그해서 다중 선택 • Ctrl+클릭으로 개별 선택 • 마우스 휠로 줌
            </div>
          )}
        </div>
      </div>

      {/* 통합된 캔버스 영역 */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${dragActive ? 'bg-blue-500/20 backdrop-blur-sm' : ''
          }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={handleCanvasMouseDown}
      >
        {dragActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/20 backdrop-blur-md border-2 border-dashed border-white/50 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 text-white mx-auto mb-4 animate-bounce" />
              <p className="text-white text-xl font-semibold">이미지를 원하는 위치에 놓으세요</p>
              <p className="text-white/70 text-sm mt-2">드롭한 위치에 이미지가 배치됩니다</p>
            </div>
          </div>
        )}

        {/* 줌 가능한 캔버스 컨테이너 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out'
          }}
        >
          {/* 선택 박스 */}
          {isSelecting && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY),
                zIndex: 9999
              }}
            />
          )}

          {/* 드래그 가능한 이미지들 */}
          {images.map((image) => (
            <div
              key={image.id}
              style={{
                position: 'absolute',
                left: image.x,
                top: image.y,
                zIndex: image.zIndex,
                width: image.width,
                height: image.height,
                pointerEvents: dragActive ? 'none' : 'auto'
              }}
              className={`bg-white rounded-xl shadow-2xl overflow-hidden cursor-move select-none group transition-transform hover:scale-105 pointer-events-auto ${selectedImages.has(image.id) ? 'ring-2 ring-blue-400' : ''
                }`}
              onMouseDown={(e) => handleImageMouseDown(e, image.id)}
            >
              {/* 이미지 */}
              <div className="relative w-full h-full">
                <img
                  src={image.src}
                  alt={image.name}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />

                {/* 드래그 인디케이터 */}
                <div className="absolute top-2 left-2 bg-black/50 text-white p-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  {selectedImages.has(image.id) && selectedImages.size > 1 ? '그룹 드래그' : '드래그'}
                </div>

                {/* 선택 표시 */}
                {selectedImages.has(image.id) && (
                  <div className="absolute top-2 right-20 bg-blue-500 text-white p-1 rounded text-xs flex items-center gap-1">
                    ✓ 선택됨
                  </div>
                )}

                {/* 액션 버튼들 */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyImageToClipboard(image);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-full shadow-lg transition-colors"
                    title="복사"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(image);
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white p-1 rounded-full shadow-lg transition-colors"
                    title="저장"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(image.id);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-lg transition-colors"
                    title="삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 이미지 정보 - 호버 시에만 표시 */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <h3
                  className="font-semibold text-white text-xs text-center leading-tight break-words overflow-hidden"
                  title={image.name}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.2'
                  }}
                >
                  {image.name}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* 빈 상태 */}
        {images.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Image className="w-20 h-20 text-white/30 mx-auto mb-6" />
              <h2 className="text-white text-2xl font-bold mb-3">이미지를 추가해보세요</h2>
              <p className="text-white/70 text-lg mb-6">
                스크린샷을 찍고 <span className="font-mono bg-white/20 px-3 py-1 rounded">Ctrl+V</span>를 눌러보세요!
              </p>
              <div className="flex items-center justify-center gap-4 text-white/50 text-sm">
                <span>• 드래그 앤 드롭</span>
                <span>• 클립보드 붙여넣기</span>
                <span>• 자유로운 배치</span>
                <span>• 마우스 휠 줌</span>
              </div>
            </div>
          </div>
        )}

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 토스트 알림 */}
        {showToast && (
          <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up">
            {showToast}
          </div>
        )}
      </div>
    </div>
  );
}