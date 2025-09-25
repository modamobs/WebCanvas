import { useState, useEffect, useRef } from 'react';
import { Upload, Image, X, Download, Copy, Move, RotateCcw } from 'lucide-react';

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
  const [isPanning, setIsPanning] = useState(false);
  const [panStartPos, setPanStartPos] = useState({ x: 0, y: 0 });

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

    // 전역 키보드 이벤트 리스너 (Ctrl+C 복사)
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+C 또는 Cmd+C로 선택된 이미지 복사
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedImages.size === 1) {
          // 단일 이미지 선택 시
          const selectedImageId = Array.from(selectedImages)[0];
          const selectedImageData = images.find(img => img.id === selectedImageId);
          if (selectedImageData) {
            e.preventDefault();
            await copyImageToClipboard(selectedImageData);
          }
        } else if (selectedImages.size > 1) {
          // 다중 이미지 선택 시 모든 이미지를 순차적으로 복사
          e.preventDefault();
          const selectedImageIds = Array.from(selectedImages);
          const selectedImagesData = images.filter(img => selectedImageIds.includes(img.id));

          showToastMessage(`${selectedImages.size}개 이미지를 순차적으로 복사 중...`);

          for (let i = 0; i < selectedImagesData.length; i++) {
            const imageData = selectedImagesData[i];
            await copyImageToClipboard(imageData);

            // 마지막 이미지가 아니면 잠시 대기
            if (i < selectedImagesData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          showToastMessage(`${selectedImages.size}개 이미지가 모두 복사되었습니다. (마지막: ${selectedImagesData[selectedImagesData.length - 1].name})`);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

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
      } else if (isPanning) {
        // 팬(캔버스 이동) 처리
        const deltaX = e.clientX - panStartPos.x;
        const deltaY = e.clientY - panStartPos.y;

        setPanOffset(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));

        setPanStartPos({ x: e.clientX, y: e.clientY });
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
      setIsPanning(false);
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
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dragover', preventDefaultDrag);
      document.removeEventListener('drop', preventDefaultDrag);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isDraggingImage, isDraggingGroup, isSelecting, selectedImage, selectedImages, dragOffset, selectionBox, images, lastMousePos, zoomLevel, isPanning, panStartPos, panOffset]);

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
          y = Math.random() * (window.innerHeight - height - 300) + 200; // 헤더 아래쪽부터 시작
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
      // 중간 버튼(휠 버튼) 클릭 시 팬 모드 시작
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setPanStartPos({ x: e.clientX, y: e.clientY });
        return;
      }

      // 좌클릭 시 선택 모드
      if (e.button === 0) {
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
    }
  };

  const removeImage = (id: number) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const resetImagePositions = () => {
    setImages(prev => prev.map((img, index) => ({
      ...img,
      x: 50 + (index % 4) * 220,
      y: 200 + Math.floor(index / 4) * 220  // 헤더 아래쪽부터 시작 (200px)
    })));
    setSelectedImages(new Set());
    showToastMessage('이미지 위치가 초기화되었습니다!');
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    showToastMessage('뷰가 초기화되었습니다!');
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
      <div className="absolute top-6 left-6 right-6 z-50">
        <div className="bg-black/20 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-wider bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
                WebCanvas
              </h1>
              <p className="text-white/70 text-sm font-sans font-medium tracking-wide">드래그, 줌, 복사가 가능한 인터랙티브 이미지 캔버스</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 border border-white/20 hover:border-white/30 backdrop-blur-sm"
              >
                <Upload className="w-4 h-4" />
                <span className="font-medium">업로드</span>
              </button>

              <button
                onClick={resetImagePositions}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 border border-white/20 hover:border-white/30 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={images.length === 0}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="font-medium">정렬</span>
              </button>

              {selectedImages.size > 0 && (
                <button
                  onClick={deleteSelectedImages}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 border border-red-500/30 hover:border-red-500/50 backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                  <span className="font-medium">삭제 ({selectedImages.size})</span>
                </button>
              )}

              <button
                onClick={resetZoom}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 border border-white/20 hover:border-white/30 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0}
              >
                <span className="text-sm">🔍</span>
                <span className="font-medium">리셋</span>
              </button>

              <div className="bg-black/20 px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10">
                <span className="text-white/80 text-sm font-mono font-medium">{Math.round(zoomLevel * 100)}%</span>
              </div>


            </div>
          </div>

          {images.length > 0 && (
            <div className="flex items-center justify-between text-white/50 text-xs">
              <div className="flex items-center gap-4">
                <span className="font-medium">이미지 {images.length}개</span>
                {selectedImages.size > 0 && (
                  <span className="text-blue-300 font-medium">{selectedImages.size}개 선택됨</span>
                )}
              </div>
              <div className="hidden md:flex items-center gap-3 text-xs">
                <span>드래그 선택</span>
                <span>•</span>
                <span>Ctrl+클릭</span>
                <span>•</span>
                <span>Ctrl+C 복사</span>
                <span>•</span>
                <span>휠 줌</span>
              </div>
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
              className={`bg-white overflow-hidden cursor-move select-none group hover:scale-[1.02] pointer-events-auto ${selectedImages.has(image.id)
                ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent shadow-2xl shadow-blue-500/20'
                : 'shadow-xl hover:shadow-2xl'
                }`}
              style={{
                ...{
                  position: 'absolute',
                  left: image.x,
                  top: image.y,
                  zIndex: image.zIndex,
                  width: image.width,
                  height: image.height,
                  pointerEvents: dragActive ? 'none' : 'auto'
                },
                transition: isDraggingImage && selectedImage === image.id ? 'none' : 'transform 0.2s ease-out'
              }}
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



                {/* 액션 버튼들 */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyImageToClipboard(image);
                    }}
                    className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg shadow-lg transition-all duration-200 backdrop-blur-sm border border-white/10"
                    title="복사"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(image);
                    }}
                    className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg shadow-lg transition-all duration-200 backdrop-blur-sm border border-white/10"
                    title="저장"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(image.id);
                    }}
                    className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-lg shadow-lg transition-all duration-200 backdrop-blur-sm border border-red-400/20"
                    title="삭제"
                  >
                    <X className="w-3.5 h-3.5" />
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
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <Image className="w-12 h-12 text-white/40" />
              </div>
              <h2 className="text-white text-3xl font-display font-semibold mb-4 tracking-wide">시작해보세요</h2>
              <p className="text-white/60 text-lg mb-8 leading-relaxed">
                이미지를 드래그하거나 <span className="font-mono bg-white/10 px-3 py-1 rounded-lg border border-white/20">Ctrl+V</span>로 붙여넣어보세요
              </p>
              <div className="grid grid-cols-2 gap-3 text-white/40 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                  <span>드래그 앤 드롭</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                  <span>클립보드 붙여넣기</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                  <span>자유로운 배치</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                  <span>줌 & 팬</span>
                </div>
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