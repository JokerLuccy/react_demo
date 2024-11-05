import type React from 'react';
import { useEffect } from 'react';
import * as Cesium from 'cesium';

type MapIndex3DWrapperProps = {
  viewerConfig?: Cesium.Viewer.ConstructorOptions;
  setViewer?: (arg: Cesium.Viewer) => void;
};

const initViewerConfig: Cesium.Viewer.ConstructorOptions = {
  // 显示隐藏-右上角图层按钮
  baseLayerPicker: false,
  // 显示隐藏-放大镜
  geocoder: false,
  // 显示隐藏-帮助(问号)按钮
  navigationHelpButton: false,
  // 显示隐藏-主页按钮
  homeButton: false,
  // 显示隐藏-切换二维三维
  sceneModePicker: false,
  // 显示隐藏-左下角动画部件
  animation: false,
  // 显示隐藏-时间轴
  timeline: false,
  // 显示隐藏-全屏按钮
  fullscreenButton: false,
  // 每个几何实例将仅以3D渲染以节省GPU内存
  scene3DOnly: false,
  // 时钟应该默认尝试提前模拟时间，则为 true,否则为 false,此选项优先于设置 Viewer#clockViewModel
  shouldAnimate: false,
  // 是否显示点击要素之后显示的信息
  infoBox: false,
  // 初始场景模式 1 2D模式 2 2D循环模式 3 3D模式
  sceneMode: 3,
  // 启用请求渲染模式
  requestRenderMode: false,
  // 全屏时渲染的HTML元素挂载位置
  fullscreenElement: document.body,
  // 取消默认选中绿色框
  selectionIndicator: false,
  imageryProvider: new Cesium.SingleTileImageryProvider({
    url: 'data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  }),
};

export const MapIndex3DWrapper: React.FC<MapIndex3DWrapperProps> = ({
  viewerConfig,
  setViewer,
}) => {
  useEffect(() => {
    console.log('token', TOKEN);

    Cesium.Ion.defaultAccessToken = TOKEN;
    const viewer: Cesium.Viewer = new Cesium.Viewer('cesium-container', {
      ...initViewerConfig,
      ...viewerConfig,
    });
    console.log('viewer', viewer);

    setViewer?.(viewer);
    // 隐藏版权
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
    return () => {
      viewer.destroy();
    };
  }, [setViewer, viewerConfig]);

  return null;
};
