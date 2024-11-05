window.CESIUM_BASE_URL = '/Cesium';
import * as Cesium from 'cesium';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import MapPortals3D from './MapPortals3D';
import { ScaleContext } from '../../ScaleContainer';
import _ from 'lodash';
import { message } from 'antd';
import station_offline from '@/assets/images/monitoring/station_offline.svg';
import station_online from '@/assets/images/monitoring/station_online.svg';
import employee_offline from '@/assets/images/monitoring/employee_offline.svg';
import employee_online from '@/assets/images/monitoring/employee_online.svg';
import employee_low from '@/assets/images/monitoring/employee_low.svg';
import employee_alert from '@/assets/images/monitoring/employee_alert.svg';
import visitor_offline from '@/assets/images/monitoring/visitor_offline.svg';
import visitor_online from '@/assets/images/monitoring/visitor_online.svg';
import visitor_low from '@/assets/images/monitoring/visitor_low.svg';
import car_offline from '@/assets/images/monitoring/car_offline.svg';
import car_online from '@/assets/images/monitoring/car_online.svg';
import car_low from '@/assets/images/monitoring/car_low.svg';
import camera_offline from '@/assets/images/monitoring/camera_offline.svg';
import camera_online from '@/assets/images/monitoring/camera_online.svg';
import label_sos from '@/assets/images/monitoring/label_sos.svg';
import { MapIndex3DWrapper } from './MapIndex3DWrapper';
import moment from 'moment';
import StationDetail from '../MapIndex/StationDetail';
import LabelDetail from '../MapIndex/LabelDetail';
import CameraDetail from '../CameraDetail';
import type { PopoverWrapperInstance } from './CesiumPopoverWrapper';
import CesiumPopoverWrapper from './CesiumPopoverWrapper';
import './index.less';
import * as turf from '@turf/turf';

export const LabelPicMap: Record<number, any> = {
  1: { 0: employee_online, 1: employee_offline, 3: employee_low },
  2: { 0: visitor_online, 1: visitor_offline, 3: visitor_low },
  3: { 0: car_online, 1: car_offline, 3: car_low },
};

export enum EntityPrevKey {
  Label,
  Station,
  Camera,
  ElectArea,
  TrackPoint,
  TrackLine,
}

type MapIndex3DProps = {
  mapAll: API.MapGroupAll[];
  mapId?: number;
  labelPosition: API.LabelCardNewPosition[];
  showEmployee: Monitoring.LabelVisible;
  showVisitor: Monitoring.LabelVisible;
  showCar: Monitoring.LabelVisible;
  showCamera: Monitoring.LabelVisible;
  stationVisible: Record<any, boolean>;
  stationPosition: API.StationPosition[];
  cameraPosition: API.CameraAllItem[];
  electronicFenceAll: API.ElectronicFenceAll[];
  locationPosition?: API.LocationPosition;
  setLocationPosition: (data?: API.LocationPosition) => void;
  alertInfo: WS.AlertInfo[];
  setAlertInfo: (prev: WS.AlertInfo[] | ((prev: WS.AlertInfo[]) => WS.AlertInfo[])) => void;
};
const MapIndex3D: React.FC<MapIndex3DProps> = ({
  mapAll,
  labelPosition,
  showEmployee,
  showCamera,
  showCar,
  showVisitor,
  stationVisible,
  stationPosition,
  cameraPosition,
  electronicFenceAll,
  locationPosition,
  alertInfo,
  setAlertInfo,
}) => {
  const [viewerInstance, setViewerInstance] = useState<Cesium.Viewer>();
  // 基站详情
  const [stationDetail, setStationDetail] = useState<API.StationPosition>();
  // 标签详情
  const [labelDetail, setLabelDetail] = useState<API.LabelCardNewPosition>();
  // 摄像头详情
  const [cameraDetail, setCameraDetail] = useState<API.CameraAllItem>();
  const contentType = useContext(ScaleContext);
  const [popoverInfo, setPopoverInfo] = useState<any>();
  const [tilesRenderComplete, setTilesRenderComplete] = useState(false);
  const alertInfoRef = useRef<WS.AlertInfo[]>([]);
  const popoverWrapperRef = useRef<PopoverWrapperInstance>(null);
  const alertInfoTimer = useRef<number>();
  const labelEntityRef = useRef<Cesium.Entity[]>([]);
  const stationEntityRef = useRef<Cesium.Entity[]>([]);
  const cameraEntityRef = useRef<Cesium.Entity[]>([]);
  const electAreaEntityRef = useRef<Cesium.Entity[]>([]);

  const handleOnMapClick = (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const { position } = event;
    const pick = viewerInstance?.scene.pick(position);

    if (pick?.id) {
      const entityIdPrev = Number(pick.id.id.split('/')[0]);
      if (
        [EntityPrevKey.Station, EntityPrevKey.Camera, EntityPrevKey.Label].includes(entityIdPrev)
      ) {
        const data = pick.id.description;

        if (entityIdPrev === EntityPrevKey.Station) {
          setStationDetail(JSON.parse(data));
        }
        if (entityIdPrev === EntityPrevKey.Camera) {
          setCameraDetail(JSON.parse(data));
        }
        if (entityIdPrev === EntityPrevKey.Label) {
          setLabelDetail(JSON.parse(data));
        }
      }
    }
    const demo = viewerInstance?.scene.camera.pickEllipsoid(position);
    if (demo) {
      const cartographic = Cesium.Cartographic.fromCartesian(demo);
      const longitude = Cesium.Math.toDegrees(cartographic.longitude);
      const latitude = Cesium.Math.toDegrees(cartographic.latitude);
      console.log('demo', longitude, latitude, cartographic.height);
    }
  };

  useEffect(() => {
    alertInfoRef.current = alertInfo;
  }, [alertInfo]);

  // 地图初始化
  useEffect(() => {
    if (viewerInstance) {
      viewerInstance.canvas.width = 1920 * contentType;
      viewerInstance.canvas.height = Math.floor(1080 * contentType);
      viewerInstance.scene.globe.baseColor = Cesium.Color.BLACK;
      // 最小缩放高度(米)
      viewerInstance.scene.screenSpaceCameraController.minimumZoomDistance = 1;
      // 最大缩放高度(米)
      viewerInstance.scene.screenSpaceCameraController.maximumZoomDistance = 10000;
      viewerInstance.scene.globe.depthTestAgainstTerrain = false;
      viewerInstance.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
      );
      viewerInstance.scene.screenSpaceCameraController.tiltEventTypes = [
        Cesium.CameraEventType.RIGHT_DRAG,
      ];
      viewerInstance.scene.screenSpaceCameraController.zoomEventTypes = [
        Cesium.CameraEventType.MIDDLE_DRAG,
        Cesium.CameraEventType.WHEEL,
        Cesium.CameraEventType.PINCH,
      ];
      viewerInstance.scene.screenSpaceCameraController.rotateEventTypes = [
        Cesium.CameraEventType.LEFT_DRAG,
      ];

      viewerInstance.scene.screenSpaceCameraController.enableCollisionDetection = false;
      viewerInstance.scene.globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(
        400.0,
        0.0,
        800.0,
        1.0,
      );
      viewerInstance.scene.globe.translucency.enabled = true;
      viewerInstance.scene.globe.translucency.frontFaceAlphaByDistance.nearValue =
        Cesium.Math.clamp(0.3, 0.0, 0.1);
      viewerInstance.scene.globe.translucency.frontFaceAlphaByDistance.farValue = 1.0;

      // 使用高德影像地图
      viewerInstance.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `${window.API_URL || API_URL}/bingmaps/hybrid/{z}/{x}/{y}.jpg`,
          maximumLevel: 15,
        }),
      );

      // 创建点击事件
      new Cesium.ScreenSpaceEventHandler(viewerInstance?.scene.canvas).setInputAction(
        handleOnMapClick,
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );
    }
  }, [contentType, viewerInstance]);

  // 调整3D模型距离地面的高度
  const handle3DHeight = (height: number, tilesModel: any) => {
    if (_.isNaN(height) || !tilesModel) {
      return;
    }
    const cartographic = Cesium.Cartographic.fromCartesian(tilesModel.boundingSphere.center);
    const surface = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height,
    );
    const offset = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      height,
    );
    const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
    tilesModel.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
  };

  // 添加模型文件
  useEffect(() => {
    message.loading({ key: 'map-loading', content: '地图加载中...', duration: 0 });

    if (!viewerInstance) return;
    setTilesRenderComplete(false);
    viewerInstance?.entities.removeAll();
    labelEntityRef.current = [];
    cameraEntityRef.current = [];
    stationEntityRef.current = [];
    electAreaEntityRef.current = [];

    const tilesModel: Cesium.Cesium3DTileset = viewerInstance?.scene.primitives.add(
      new Cesium.Cesium3DTileset({
        url: `/DemoData/Scene/tileset.json`,
      }),
    );

    tilesModel.readyPromise.then((currentModel: any) => {
      // 定位到模型
      viewerInstance?.zoomTo(
        currentModel,
        new Cesium.HeadingPitchRange(0.5, -90.0, currentModel.boundingSphere.radius * 2.0),
      );
      handle3DHeight(225, tilesModel);
      setTilesRenderComplete(true);
      message.destroy('map-loading');
    });
  }, [viewerInstance]);

  const updateLabelEntity = (
    targetEntity: any,
    data: API.LabelCardNewPosition,
    show: boolean = true,
  ) => {
    targetEntity._description.setValue(JSON.stringify(data));
    targetEntity._position = new Cesium.CallbackProperty(() => {
      return Cesium.Cartesian3.fromDegrees(data.locationX, data.locationY, data.locationZ);
    }, false);
    const findRes = alertInfoRef.current.findLast((el) => el.labelCardId === data.labelCardId);
    targetEntity._billboard.image = new Cesium.CallbackProperty(() => {
      return findRes
        ? findRes.type === 12
          ? label_sos
          : employee_alert
        : LabelPicMap[data.resourceType][data.status || 0];
    }, false);
    if (!findRes) {
      targetEntity.billboard!.scale = new Cesium.CallbackProperty(() => {
        return 1;
      }, false);
    }

    targetEntity.show = show;
  };

  const updateStationEntity = (
    targetEntity: any,
    data: API.StationPosition,
    show: boolean = true,
  ) => {
    targetEntity._description.setValue(JSON.stringify(data));
    targetEntity._billboard._image.setValue([station_online, station_offline][data.status || 0]);
    targetEntity.show = show;
    targetEntity._position = new Cesium.CallbackProperty(() => {
      return Cesium.Cartesian3.fromDegrees(data.locationX, data.locationY, data.locationZ);
    }, false);
  };

  const updateCameraEntity = (targetEntity: any, data: API.CameraAllItem, show: boolean = true) => {
    targetEntity._description.setValue(JSON.stringify(data));
    targetEntity._billboard._image.setValue([camera_online, camera_offline][data.status || 0]);
    targetEntity.show = show;

    targetEntity._position = new Cesium.CallbackProperty(() => {
      return Cesium.Cartesian3.fromDegrees(data.locationX, data.locationY, data.locationZ);
    }, false);
  };

  const updateElectAreaEntity = (targetEntity: any, data: API.ElectronicFenceAll) => {
    targetEntity.name = data.name;
    targetEntity._label._text.setValue(data.name || data.id);
    targetEntity._label._fillColor.setValue(Cesium.Color.fromCssColorString('#fff'));
    targetEntity._wall._material._color.setValue(Cesium.Color.fromCssColorString(data.borderColor));
    const heights: number[] = [];
    const formatLocation = data.coordinates.map((l) => {
      heights.push(l?.z || 0);
      const res = [l.x, l.y];
      return res;
    });
    targetEntity._wall._positions.setValue(
      Cesium.Cartesian3.fromDegreesArray(_.flattenDepth(formatLocation)),
    );
    targetEntity._wall._minimumHeights.setValue(heights);
    targetEntity._wall._maximumHeights.setValue(heights.map((z) => z + (data.fenceHeight || 0)));
    targetEntity._position = new Cesium.CallbackProperty(() => {
      const polygon = turf.polygon([formatLocation]);
      const [lon, lat] = turf.pointOnFeature(polygon).geometry.coordinates;
      return Cesium.Cartesian3.fromDegrees(lon, lat);
    }, false);
  };

  // 渲染标签(模型加载完毕开始渲染)
  useEffect(() => {
    if (!tilesRenderComplete || !labelPosition.length) {
      return;
    }

    const getShow = (data: API.LabelCardNewPosition) => {
      let show = true;
      if (data.resourceType === 1) {
        const obj: Record<number, any> = {
          0: showEmployee.online,
          1: showEmployee.offline,
          3: showEmployee.low,
        };
        show = obj[data.status];
      }
      if (data.resourceType === 2) {
        const obj: Record<number, any> = {
          0: showVisitor.online,
          1: showVisitor.offline,
          3: showVisitor.low,
        };
        show = obj[data.status];
      }
      if (data.resourceType === 3) {
        const obj: Record<number, any> = { 0: showCar.online, 1: showCar.offline, 3: showCar.low };
        show = obj[data.status];
      }
      return show;
    };
    const oldLabelIds: string[] = [];
    const removeIds: string[] = [];
    const labelIds = labelPosition.map((item) => `${EntityPrevKey.Label}/${item.labelCardId}`);

    labelEntityRef.current.forEach((item) => {
      const labelCardId = item.id;
      if (labelCardId) {
        if (labelIds.includes(labelCardId) && !oldLabelIds.includes(labelCardId)) {
          oldLabelIds.push(labelCardId);
        } else {
          // 去除不存在标签
          viewerInstance?.entities.remove(item);
          removeIds.push(labelCardId);
        }
      }
    });
    labelEntityRef.current = labelEntityRef.current.filter((entity) => {
      return !removeIds.includes(entity.id);
    });
    labelPosition.forEach((item) => {
      const key = `${EntityPrevKey.Label}/${item.labelCardId}`;
      if (oldLabelIds.includes(key)) {
        const targetEntity = labelEntityRef.current.find((entity) => entity.id === key);

        if (targetEntity) {
          updateLabelEntity(targetEntity, item, getShow(item));
        }
      } else {
        const findRes = alertInfoRef.current.findLast((el) => el.labelCardId === item.labelCardId);

        const labelEntity = new Cesium.Entity({
          name: item.name,
          id: key,
          position: Cesium.Cartesian3.fromDegrees(item.locationX, item.locationY, item.locationZ),
          description: JSON.stringify(item),
          label: {
            text: item.name || item.labelCardId,
            font: '18px monospace',
            style: Cesium.LabelStyle.FILL,
            fillColor: Cesium.Color.fromCssColorString('#fff'),
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -40),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          billboard: {
            image: findRes
              ? findRes.type
                ? label_sos
                : employee_alert
              : LabelPicMap[item.resourceType][item.status || 0],

            width: 30,
            height: 30,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            pixelOffset: new Cesium.Cartesian2(0, -20),
          },
          show: getShow(item),
        });
        viewerInstance?.entities.add(labelEntity);
        labelEntityRef.current.push(labelEntity);
      }
    });
  }, [
    labelPosition,
    tilesRenderComplete,
    viewerInstance,
    showEmployee.offline,
    showEmployee.online,
    showEmployee.low,
    showVisitor.offline,
    showVisitor.online,
    showVisitor.low,
    showCar.offline,
    showCar.online,
    showCar.low,
  ]);

  // 渲染基站(模型加载完毕开始渲染)
  useEffect(() => {
    if (!tilesRenderComplete || !stationPosition.length) {
      return;
    }
    const oldStationIds: string[] = [];
    const removeIds: string[] = [];
    const stationIds = stationPosition.map((item) => `${EntityPrevKey.Label}/${item.stationId}`);
    stationEntityRef.current.forEach((item) => {
      const stationId = item.id;
      if (stationId) {
        if (stationIds.includes(stationId) && !oldStationIds.includes(stationId)) {
          oldStationIds.push(stationId);
        } else {
          // 去除不存在标签
          viewerInstance?.entities.remove(item);
          removeIds.push(stationId);
        }
      }
    });
    stationEntityRef.current = stationEntityRef.current.filter((entity) => {
      return !removeIds.includes(entity.id);
    });
    const getShow = (data: API.StationPosition) => {
      return stationVisible[data.stationId] || true;
    };
    stationPosition.forEach((item) => {
      const key = `${EntityPrevKey.Station}/${item.stationId}`;
      if (oldStationIds.includes(key)) {
        const targetEntity = stationEntityRef.current.find((entity) => entity.id === key);
        if (targetEntity) {
          updateStationEntity(targetEntity, item, getShow(item));
        }
      } else {
        const stationEntity = new Cesium.Entity({
          name: item.stationName,
          id: key,
          position: Cesium.Cartesian3.fromDegrees(item.locationX, item.locationY, item.locationZ),
          description: JSON.stringify(item),

          label: {
            text: item.stationName || item.stationId,
            font: '18px monospace',
            style: Cesium.LabelStyle.FILL,
            fillColor: Cesium.Color.fromCssColorString('#fff'),
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          billboard: {
            image: [station_online, station_offline][item.status || 0],
            width: 30,
            height: 30,
            scale: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          show: getShow(item),
        });
        viewerInstance?.entities.add(stationEntity);
        stationEntityRef.current.push(stationEntity);
      }
    });
  }, [stationPosition, tilesRenderComplete, viewerInstance, stationVisible]);

  // 渲染摄像头(模型加载完毕开始渲染)
  useEffect(() => {
    if (!tilesRenderComplete || !cameraPosition.length) {
      return;
    }

    const getShow = (data: API.CameraAllItem) => {
      return data.status ? showCamera.offline : showCamera.online;
    };

    const oldCameraIds: string[] = [];
    const removeIds: string[] = [];
    const cameraIds = cameraPosition.map((item) => `${EntityPrevKey.Camera}/${item.id}`);

    cameraEntityRef.current.forEach((item) => {
      const cameraId = item.id;
      if (cameraId) {
        if (cameraIds.includes(cameraId) && !oldCameraIds.includes(cameraId)) {
          oldCameraIds.push(cameraId);
        } else {
          // 去除不存在标签
          viewerInstance?.entities.remove(item);
          removeIds.push(cameraId);
        }
      }
    });
    cameraEntityRef.current = cameraEntityRef.current.filter((entity) => {
      return !removeIds.includes(entity.id);
    });
    cameraPosition.forEach((item) => {
      const key = `${EntityPrevKey.Camera}/${item.id}`;

      if (oldCameraIds.includes(key)) {
        const targetEntity = cameraEntityRef.current.find((entity) => entity.id === key);
        if (targetEntity) {
          updateCameraEntity(targetEntity, item, getShow(item));
        }
      } else {
        const cameraEntity = new Cesium.Entity({
          name: item.name,
          id: key,
          position: Cesium.Cartesian3.fromDegrees(item.locationX, item.locationY, item.locationZ),
          description: JSON.stringify(item),
          label: {
            text: item.name || `${item.id}`,
            font: '18px monospace',
            style: Cesium.LabelStyle.FILL,
            fillColor: Cesium.Color.fromCssColorString('#fff'),
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          billboard: {
            image: [camera_online, camera_offline][item.status || 0],
            width: 30,
            height: 30,
            scale: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          show: getShow(item),
        });
        viewerInstance?.entities.add(cameraEntity);
        cameraEntityRef.current.push(cameraEntity);
      }
    });
  }, [cameraPosition, tilesRenderComplete, viewerInstance, showCamera.online, showCamera.offline]);

  // 绘制电子围栏
  useEffect(() => {
    if (!tilesRenderComplete || !electronicFenceAll.length) return;

    const oldElectIds: string[] = [];
    const removeIds: string[] = [];
    const electIds = electronicFenceAll.map((item) => `${EntityPrevKey.ElectArea}/${item.id}`);

    electAreaEntityRef.current.forEach((item) => {
      const electId = item.id;
      if (electId) {
        if (electIds.includes(electId) && !oldElectIds.includes(electId)) {
          oldElectIds.push(electId);
        } else {
          // 去除不存在标签
          viewerInstance?.entities.remove(item);
          removeIds.push(electId);
        }
      }
    });
    electAreaEntityRef.current = electAreaEntityRef.current.filter((entity) => {
      return !removeIds.includes(entity.id);
    });
    electronicFenceAll.forEach((item) => {
      const key = `${EntityPrevKey.ElectArea}/${item.id}`;
      if (oldElectIds.includes(key)) {
        const targetEntity = electAreaEntityRef.current.find((entity) => entity.id === key);
        if (targetEntity) {
          updateElectAreaEntity(targetEntity, item);
        }
      } else {
        const heights: number[] = [];
        const formatLocation = item.coordinates.map((l) => {
          heights.push(l?.z || 0);
          const res = [l.x, l.y];
          return res;
        });
        const polygon = turf.polygon([formatLocation]);
        const center = turf.pointOnFeature(polygon);
        const labelHeight = _.mean(heights) + 5;

        const wall: any = new Cesium.Entity({
          name: item.name,
          id: key,
          position: Cesium.Cartesian3.fromDegrees(
            center.geometry.coordinates[0],
            center.geometry.coordinates[1],
            labelHeight,
          ),
          wall: {
            positions: Cesium.Cartesian3.fromDegreesArray(_.flattenDepth(formatLocation)),
            material: Cesium.Color.fromCssColorString(item.borderColor),
            minimumHeights: heights,
            maximumHeights: heights.map((z) => z + (item.fenceHeight || 0)),
          },
          label: {
            text: item.name,
            fillColor: Cesium.Color.fromCssColorString('#fff'),
            font: '18px monospace',
            style: Cesium.LabelStyle.FILL,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        viewerInstance?.entities.add(wall);
        electAreaEntityRef.current.push(wall);
      }
    });
  }, [tilesRenderComplete, JSON.stringify(electronicFenceAll), viewerInstance?.entities]);

  useEffect(() => {
    if (!tilesRenderComplete) return;
    if (locationPosition) {
      popoverWrapperRef.current?.hide();
      const boundingSphere = new Cesium.BoundingSphere(
        Cesium.Cartesian3.fromDegrees(locationPosition.locationX, locationPosition.locationY),
        15000,
      );
      // 定位到初始位置
      viewerInstance?.camera.flyToBoundingSphere(boundingSphere, {
        duration: 0,
      });
      const position = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
        viewerInstance!.scene,
        Cesium.Cartesian3.fromDegrees(locationPosition.locationX, locationPosition.locationY),
      );

      const targetEntity = _.has(locationPosition, 'labelCardId')
        ? labelEntityRef.current.find((entity) =>
            entity.id.includes(`${EntityPrevKey.Label}/${locationPosition.labelCardId}`),
          )
        : stationEntityRef.current.find((entity) =>
            entity.id.includes(`${EntityPrevKey.Station}/${locationPosition.stationId}`),
          );
      const titleText = _.has(locationPosition, 'labelCardId') ? '人员信息' : '基站信息';
      if (targetEntity) {
        const info = targetEntity.description?.getValue(new Cesium.JulianDate());
        if (info) {
          setPopoverInfo(JSON.parse(info));
        }
        const width = targetEntity?.billboard?.width?.getValue(new Cesium.JulianDate());
        const height = targetEntity.billboard?.height?.getValue(new Cesium.JulianDate());
        popoverWrapperRef.current?.show({
          width: width,
          height: height,
          left: position.x - width / 2,
          top: position.y - height,
          titleText,
        });
        viewerInstance?.scene.preRender.addEventListener(() => {
          const windowPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
            viewerInstance.scene,
            Cesium.Cartesian3.fromDegrees(locationPosition.locationX, locationPosition.locationY),
          );
          popoverWrapperRef.current?.updateLocation({
            left: windowPosition.x - width / 2,
            top: windowPosition.y - height,
          });
        });
      }
    }
  }, [tilesRenderComplete, locationPosition, viewerInstance?.camera, viewerInstance?.scene]);

  const getPopoverContent = useCallback(() => {
    if (_.has(popoverInfo, 'labelCardId')) {
      return (
        <>
          <p>姓名：{popoverInfo?.name || '-'}</p>
          <p>工号：{popoverInfo?.resourceNo || '-'}</p>
          <p>标签ID：{popoverInfo?.labelCardId || '-'}</p>
        </>
      );
    }
    if (_.has(popoverInfo, 'stationId')) {
      return (
        <>
          <p>基站名称：{popoverInfo?.stationName || '-'}</p>
          <p>基站编码：{popoverInfo?.stationId || '-'}</p>
        </>
      );
    }
    return null;
  }, [popoverInfo]);

  // 报警图标
  useEffect(() => {
    if (alertInfoTimer.current) {
      clearInterval(alertInfoTimer.current);
    }
    alertInfoTimer.current = window.setInterval(() => {
      alertInfoRef.current.forEach((item) => {
        const targetEntity = labelEntityRef.current.find((entity) => {
          const labelCardId = entity.id.split('/')[1];
          return labelCardId === item.labelCardId;
        });
        if (targetEntity) {
          const toggle = Date.now() % 2 === 0;

          targetEntity.billboard!.scale = new Cesium.CallbackProperty(() => {
            return toggle ? 1 : 0.7;
          }, false);

          const duration = moment().diff(moment(item.alertTime)) / 1000;
          // 大于5秒自动消警
          if (duration > 5) {
            setAlertInfo((prev) => prev.filter((v) => v.labelCardId !== item.labelCardId));
          }
        }
      });
    }, 500);
    return () => {
      if (alertInfoTimer.current) {
        clearInterval(alertInfoTimer.current);
      }
    };
  }, [setAlertInfo]);

  return (
    <MapPortals3D>
      <div id="cesium-container" style={{ position: 'relative' }}>
        <CesiumPopoverWrapper
          ref={popoverWrapperRef}
          content={<div style={{ width: 'max-content' }}>{getPopoverContent()}</div>}
          placement="top"
          destroyTooltipOnHide
        />
      </div>
      <MapIndex3DWrapper setViewer={setViewerInstance} />

      {stationDetail && <StationDetail {...{ stationDetail, setStationDetail }} />}
      {labelDetail && <LabelDetail {...{ labelDetail, setLabelDetail, mapAll }} />}
      {cameraDetail && <CameraDetail {...{ cameraDetail, setCameraDetail }} />}
    </MapPortals3D>
  );
};

export default React.memo(MapIndex3D);
