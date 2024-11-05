import camera_offline from '@/assets/images/monitoring/camera_offline.svg';
import camera_online from '@/assets/images/monitoring/camera_online.svg';
import car_low from '@/assets/images/monitoring/car_low.svg';
import car_offline from '@/assets/images/monitoring/car_offline.svg';
import car_online from '@/assets/images/monitoring/car_online.svg';
import close_button from '@/assets/images/monitoring/close_button.png';
import employee_alert from '@/assets/images/monitoring/employee_alert.svg';
import employee_low from '@/assets/images/monitoring/employee_low.svg';
import employee_offline from '@/assets/images/monitoring/employee_offline.svg';
import employee_online from '@/assets/images/monitoring/employee_online.svg';
import label_sos from '@/assets/images/monitoring/label_sos.svg';
import station_offline from '@/assets/images/monitoring/station_offline.svg';
import station_online from '@/assets/images/monitoring/station_online.svg';
import visitor_low from '@/assets/images/monitoring/visitor_low.svg';
import visitor_offline from '@/assets/images/monitoring/visitor_offline.svg';
import visitor_online from '@/assets/images/monitoring/visitor_online.svg';
import { DEFAULT_ZOOM, FeatureDataType } from '@/constants/monitoring';
import { hexToRgba, renderMapFiles } from '@/helpers/map';
import moment from 'moment';
import { Overlay } from 'ol';
import { defaults as defaultControls } from 'ol/control';
import type { Extent } from 'ol/extent';
import { containsCoordinate } from 'ol/extent';
import Feature from 'ol/Feature';
import { Circle, Point, Polygon } from 'ol/geom';
import { Vector as VectorLayer } from 'ol/layer';
import Map from 'ol/Map';
import { Vector as VectorSource } from 'ol/source';
import { Fill, Icon, RegularShape, Stroke, Style, Text } from 'ol/style';
import View from 'ol/View';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ScaleContext } from '../../ScaleContainer';
import CameraDetail from '../CameraDetail';
import LabelDetail from './LabelDetail';
import MapPortals from './MapPortals';
import StationDetail from './StationDetail';

import _ from 'lodash';
import CircleStyle from 'ol/style/Circle';
import './index.less';

type MapIndexProps = {
  mapId?: number;
  mapAll: API.MapGroupAll[];
  labelPosition: API.LabelCardNewPosition[];
  stationPosition: API.StationPosition[];
  locationPosition?: API.LocationPosition;
  setLocationPosition: (data?: API.LocationPosition) => void;
  allTracks: Record<string, API.LabelTrack[]>;
  showTrack: boolean;
  electronicFenceAll: API.ElectronicFenceAll[];
  cameraPosition: API.CameraAllItem[];
  showCamera: Monitoring.LabelVisible;
  alertInfo: WS.AlertInfo[];
  setAlertInfo: (prev: WS.AlertInfo[] | ((prev: WS.AlertInfo[]) => WS.AlertInfo[])) => void;
  getCurrentZoom: (arg: number) => void;
};

const PicMap: any = {
  1: { 0: employee_online, 1: employee_offline, 3: employee_low },
  2: { 0: visitor_online, 1: visitor_offline, 3: visitor_low },
  3: { 0: car_online, 1: car_offline, 3: car_low },
};
const PicStationMap: any = { 0: station_online, 1: station_offline };

const colorMap: Record<number, string> = {
  0: 'rgb(2,216,118)',
  1: 'rgb(255,67,10)',
  3: 'rgb(245,154,35)',
};

const MapIndex: React.FC<MapIndexProps> = (props) => {
  const {
    mapId,
    mapAll,
    labelPosition,
    stationPosition,
    locationPosition,
    setLocationPosition,
    electronicFenceAll,
    cameraPosition,
    showCamera,
    alertInfo,
    setAlertInfo,
    getCurrentZoom,
  } = props;
  const [map, setMap] = useState<Map>();
  const [hasDom, setHasDom] = useState<boolean>(false);
  const contentType = useContext(ScaleContext);
  const popupOverlayRef = useRef<Overlay>();
  const popupRef = useRef<HTMLDivElement>(null);
  const popupContentRef = useRef<HTMLDivElement>(null);
  // 基站详情
  const [stationDetail, setStationDetail] = useState<API.StationPosition>();
  // 标签详情
  const [labelDetail, setLabelDetail] = useState<API.LabelCardNewPosition>();
  // 摄像头详情
  const [cameraDetail, setCameraDetail] = useState<API.CameraAllItem>();
  const [innerHtml, setInnerHtml] = useState<string>('');
  const alertInfoTimer = useRef<any>();
  const alertInfoRef = useRef<WS.AlertInfo[]>([]);
  const [mapCenter, setMapCenter] = useState<Extent | undefined>();

  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);

  const getZoomOutIcon = (status: number, resourceType: number) => {
    let image: any = new CircleStyle({
      radius: 5,
      fill: new Fill({
        color: colorMap[status],
      }),
    });

    if (resourceType === 1) {
      image = new RegularShape({
        fill: new Fill({
          color: colorMap[status],
        }),
        points: 5,
        radius: 10,
        radius2: 5,
        angle: 0,
      });
    }
    if (resourceType === 2) {
      image = new CircleStyle({
        radius: 5,
        fill: new Fill({
          color: colorMap[status],
        }),
      });
    }

    if (resourceType === 3) {
      image = new RegularShape({
        fill: new Fill({
          color: colorMap[status],
        }),
        points: 4,
        radius: 10,
        angle: Math.PI / 4,
      });
    }
    // 基站
    if (resourceType === -1) {
      image = new RegularShape({
        fill: new Fill({
          color: colorMap[status],
        }),
        points: 3,
        radius: 10,
        rotation: 0,
        angle: 0,
      });
    }

    // 摄像头
    if (resourceType === -2) {
      image = new RegularShape({
        fill: new Fill({
          color: colorMap[status],
        }),
        points: 4,
        radius: 10,
        angle: Math.PI / 4,
        rotation: Math.PI / 4,
      });
    }

    return new Style({
      image,
    });
  };

  useEffect(() => {
    alertInfoRef.current = alertInfo;
  }, [alertInfo]);

  // 生成地图
  useEffect(() => {
    if (!hasDom) return;
    const mapContent = new Map({
      target: 'map-container',
      controls: defaultControls({ zoom: false }),
      view: new View({
        maxZoom: 25,
        minZoom: 14,
      }),
    });

    setMap(mapContent);

    mapContent.getView().on(
      'change:resolution',
      _.debounce(() => {
        const zoom = mapContent.getView().getZoom();

        if (zoom) {
          setCurrentZoom(zoom);
          getCurrentZoom(zoom);
        }
      }, 500),
    );

    mapContent.on('pointermove', (evt) => {
      try {
        const value = mapContent.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
        if (value && value.get('data') && value.getGeometry()?.getType() === 'Point') {
          mapContent.getTargetElement().style.cursor = 'pointer';
        } else {
          mapContent.getTargetElement().style.cursor = 'auto';
        }
      } catch {}
    });
    mapContent.on('click', function (evt) {
      const feature = mapContent.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const data = feature.get('data');
        const type = feature.get('FeatureDataType');
        if (!data || type === undefined) return;
        const setDetail: Record<number, any> = {
          [FeatureDataType.STATION]: setStationDetail,
          [FeatureDataType.CAMERA]: setCameraDetail,
          [FeatureDataType.LABEL]: setLabelDetail,
        };
        if (typeof setDetail[type] === 'function') {
          setDetail[type](data);
        }
      }
    });
    mapContent.on('moveend', (e: any) => {
      _.debounce(() => {
        const _center = mapContent.getView().calculateExtent(mapContent.getSize());

        setMapCenter(_center);
      }, 300)();
    });

    // 弹窗
    const popupOverlay = new Overlay({
      positioning: 'top-center',
      stopEvent: false,
      element: popupRef.current as HTMLElement,
      autoPan: {
        animation: {
          duration: 200,
        },
      },
    });
    popupOverlay.set('isActive', true);
    popupOverlay.set('overlayId', 'detail');
    mapContent.addOverlay(popupOverlay);
    popupOverlayRef.current = popupOverlay;

    return () => {
      // 释放地图占用的内存
      mapContent?.getAllLayers()?.forEach((item) => item.dispose());
      mapContent?.dispose();
    };
  }, [hasDom]);
  // 渲染地图
  useEffect(() => {
    renderMapFiles({ map, mapId, mapAll });
  }, [map, mapId, mapAll]);
  // canvas放大缩小
  useEffect(() => {
    if (map) {
      map.setSize([Math.floor(1920 * contentType), Math.floor(1080 * contentType)]);
    }
  }, [map, contentType]);

  // 渲染摄像头
  useEffect(() => {
    if (!map || !mapCenter) return;

    const layerId = 'cameraPosition';
    const featureList = cameraPosition
      .filter(
        (item) =>
          ((item.status === 0 && showCamera.online) || (item.status === 1 && showCamera.offline)) &&
          containsCoordinate(mapCenter, [item.locationX, item.locationY]),
      )
      .map((item) => {
        const feature = new Feature({
          geometry: new Point([item.locationX, item.locationY]),
        });
        feature.set('data', item);
        feature.set('FeatureDataType', FeatureDataType.CAMERA);
        feature.set('currentZoom', currentZoom);
        return feature;
      });

    const vectorSource = new VectorSource({
      features: featureList,
    });

    const layer = new VectorLayer({
      source: vectorSource,
      zIndex: 15,
      style: (feature) => {
        const data: API.CameraAllItem = feature.get('data');
        const zoom = feature.get('currentZoom');
        if (zoom < 16) {
          return getZoomOutIcon(data.status, -2);
        }
        return new Style({
          image: new Icon({
            anchor: [12, 30],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            src: [camera_online, camera_offline][data.status || 0],
          }),
        });
      },
    });

    layer.set('layerId', layerId);
    let hasLayer = false;
    map.getAllLayers().forEach((item) => {
      if (item.get('layerId') === layerId) {
        hasLayer = true;
        item.setSource(vectorSource);
        item.changed();
      }
    });
    if (!hasLayer) {
      map.addLayer(layer);
    }
  }, [JSON.stringify(cameraPosition), showCamera, map, mapCenter, currentZoom]);

  // 渲染基站
  useEffect(() => {
    if (!map || !mapCenter) return;
    const layerId = 'Station';

    const stationFeatureList = stationPosition
      .filter((item) => containsCoordinate(mapCenter, [item.locationX, item.locationY]))
      .map((item) => {
        const feature = new Feature({
          geometry: new Point([item.locationX, item.locationY]),
        });
        feature.set('data', item);
        feature.set('FeatureDataType', FeatureDataType.STATION);
        feature.set('currentZoom', currentZoom);
        return feature;
      });
    const vectorSource = new VectorSource({
      features: [...stationFeatureList],
    });

    const layer = new VectorLayer({
      source: vectorSource,
      zIndex: 15,
      style: (feature) => {
        const data: API.StationPosition = feature.get('data');
        const zoom = feature.get('currentZoom');
        if (zoom < 16) {
          return getZoomOutIcon(data.status, -1);
        }
        return new Style({
          image: new Icon({
            anchor: [12.5, 30],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            src: PicStationMap[data.status || 0],
          }),
        });
      },
    });

    layer.set('layerId', layerId);
    let hasLayer = false;
    map.getAllLayers().forEach((item) => {
      if (item.get('layerId') === layerId) {
        hasLayer = true;
        item.setSource(vectorSource);
        item.changed();
      }
    });
    if (!hasLayer) {
      map.addLayer(layer);
    }
  }, [JSON.stringify(stationPosition), map, mapCenter, currentZoom]);

  // 渲染标签
  useEffect(() => {
    if (!map || !mapCenter) return;

    const renderLabel = [...(labelPosition || [])].filter((item) =>
      containsCoordinate(mapCenter, [item.locationX, item.locationY]),
    );
    if (locationPosition && 'labelCardId' in locationPosition) {
      const index = renderLabel.findIndex(
        (item) => item.labelCardId === locationPosition.labelCardId,
      );
      if (index !== -1) {
        const lastItem = renderLabel.splice(index, 1)[0];
        if (lastItem) {
          renderLabel.push(lastItem);
        }
      }
    }

    const labelFeatureList = renderLabel.map((item) => {
      const feature = new Feature({
        geometry: new Point([item.locationX, item.locationY]),
      });

      feature.set('data', item);
      feature.set('FeatureDataType', FeatureDataType.LABEL);
      feature.set('currentZoom', currentZoom);
      return feature;
    });
    const vectorSource = new VectorSource({
      features: [...labelFeatureList],
    });

    const layer = new VectorLayer({
      source: vectorSource,
      zIndex: 15,
      style: (feature) => {
        const data: API.LabelCardNewPosition = feature.get('data');
        const { resourceType = 1 } = data;
        const findLast = alertInfoRef.current.findLast((el) => el.labelCardId === data.labelCardId);
        const zoom = feature.get('currentZoom');

        if (zoom < 16) {
          return getZoomOutIcon(data.status, resourceType);
        }

        return new Style({
          image: new Icon({
            anchor: findLast ? [19, 45] : [12.5, 30],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            src: findLast
              ? findLast.type === 12
                ? label_sos
                : employee_alert
              : PicMap[resourceType][data.status || 0],
          }),
          text: new Text({
            text: data.name || data.labelCardId,
            font: 'normal 14px sans-serif',
            fill: new Fill({
              color: '#000',
            }),
            stroke: new Stroke({
              color: '#fff',
              width: 2,
            }),
            offsetX: 0,
            offsetY: findLast ? -55 : -40,
          }),
        });
      },
    });

    layer.set('layerId', 'Label');
    let hasLayer = false;
    map.getAllLayers().forEach((item) => {
      if (item.get('layerId') === 'Label') {
        hasLayer = true;
        item.setSource(vectorSource);
        item.changed();
      }
    });
    if (!hasLayer) {
      map.addLayer(layer);
    }
  }, [
    JSON.stringify(labelPosition),
    map,
    JSON.stringify(locationPosition),
    mapCenter,
    currentZoom,
  ]);

  // 渲染定位弹窗
  useEffect(() => {
    if (!map) return;
    // 居中
    if (locationPosition && locationPosition.center) {
      map.getView().setCenter([locationPosition.locationX, locationPosition.locationY]);
      setLocationPosition({ ...locationPosition, center: false });
    }
    // 弹窗
    if (locationPosition && 'labelCardId' in locationPosition) {
      const findLabel =
        labelPosition.find((item) => item.labelCardId === locationPosition.labelCardId) ||
        locationPosition;
      popupOverlayRef.current?.setPosition([findLabel.locationX, findLabel.locationY]);
      setInnerHtml(`<div>
      <div class="ol-popup-title">人员信息</div>
      <div style="margin:0 18px;color: #CEE2FF; padding: 12px 0 10px 0;">
        <div style="line-height: 1;">
          <span style="display:inline-block;width:56px;text-align:left; line-height: 1;">
            姓名：
          </span>
          <span style="display:inline-block;text-align:left; line-height: 1;">
            ${findLabel.name || '-'}
          </span>
        </div>
        <div style="margin-top: 11px;line-height: 1;display: ${
          findLabel.resourceType === 2 ? 'none' : 'block'
        }">
          <span style="display:inline-block;width:56px;text-align:left; line-height: 1;">
            工号：
          </span>
          <span style="display:inline-block;text-align:left; line-height: 1;">
            ${findLabel.resourceNo || '-'}
          </span>
        </div>
        <div style="margin-top: 11px;line-height: 1;">
          <span style="display:inline-block;width:56px;text-align:left; line-height: 1;">
            标签ID：
          </span>
          <span style="display:inline-block;text-align:left; line-height: 1;">
            ${findLabel.labelCardId || '-'}
          </span>
        </div>
      </div>
    </div>`);
    }
    if (locationPosition && 'stationId' in locationPosition) {
      const findLabel =
        stationPosition.find((item) => item.stationId === locationPosition.stationId) ||
        locationPosition;
      popupOverlayRef.current?.setPosition([findLabel.locationX, findLabel.locationY]);
      setInnerHtml(`<div>
      <div class="ol-popup-title">基站信息</div>
      <div style="margin:0 18px;color: #CEE2FF; padding: 12px 0 10px 0;">
        <div style="line-height: 1; display: flex;align-items: flex-start;justify-content: space-between;">
          <span style="display:inline-block;width:93px;text-align:left; color: #CEE2FF; line-height: 1;">基站名称：</span>
        <span style="display:inline-block;text-align:left; color: #CEE2FF; line-height: 1; width: 103px;">
         ${findLabel.stationName || '-'}
        </span>
      </div>
      <div style="margin-top: 12px; margin-bottom: 10px; line-height: 1;display: flex;align-item: flex-start;justify-content: space-between;">
        <span style="display:inline-block;width:93px;text-align:left;line-height: 1;">基站编码：</span>
        <span style="display:inline-block;text-align:left;line-height: 1;width: 103px;">
        ${findLabel.stationId || '-'}
        </span>
      </div>
      </div>
        </div>`);
    }
  }, [map, stationPosition, labelPosition, locationPosition, setLocationPosition]);
  useEffect(() => {
    if (!locationPosition && innerHtml) {
      popupOverlayRef.current?.setPosition(undefined);
      setInnerHtml('');
    }
  }, [locationPosition, innerHtml]);

  // 渲染电子围栏
  useEffect(() => {
    if (!map) return;
    const features = electronicFenceAll
      .filter((item) => item.mapId === mapId)
      .map((item) => {
        const feature = new Feature({
          geometry:
            item.shapeType === 1
              ? new Circle([item.origin.x, item.origin.y], item.radius)
              : new Polygon([item.coordinates?.map((el) => [el.x, el.y])]),
        });
        feature.set('data', item);
        feature.set('FeatureDataType', FeatureDataType.FENCES);
        return feature;
      });
    const vectorSource = new VectorSource({ features });
    const layer = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        const featureData: API.ElectronicFenceAll = feature.get('data');
        return new Style({
          fill: new Fill({
            color: hexToRgba(featureData.color, 0.1),
          }),
          stroke: new Stroke({
            color: hexToRgba(featureData.borderColor),
          }),
          text: new Text({
            text: featureData.name,
            font: '14px sans-serif',
            fill: new Fill({
              color: featureData.color,
            }),
            stroke: new Stroke({
              color: '#fff',
              width: 2,
            }),
          }),
        });
      },
      zIndex: 5,
    });

    layer.set('layerId', 'Fence');
    let hasLayer = false;
    map.getAllLayers().forEach((item) => {
      if (item.get('layerId') !== 'Fence') return;
      if (!electronicFenceAll || !electronicFenceAll.length) {
        item.dispose();
        map.removeLayer(item);
        return;
      }
      hasLayer = true;
      item.setSource(vectorSource);
      item.changed();
    });
    if (!hasLayer) {
      map.addLayer(layer);
    }
  }, [map, electronicFenceAll, mapId]);

  // 报警图标
  useEffect(() => {
    if (alertInfoTimer.current) {
      clearInterval(alertInfoTimer.current);
    }
    if (alertInfo?.length) {
      alertInfoTimer.current = setInterval(() => {
        const allLayers = map?.getAllLayers();
        const labelLayer = allLayers?.find((item) => item.get('layerId') === 'Label');
        const features = labelLayer?.getSource()?.getFeatures() || [];
        const deleteAlert: string[] = [];
        alertInfo.forEach((data) => {
          if (!data) return;
          const duration = moment().diff(moment(data.alertTime)) / 1000;
          let showOld = false;
          if (duration >= 5) {
            // 去除5S以上的
            showOld = true;
            deleteAlert.push(data.reqId);
          }
          // 修改图标颜色
          if (!labelLayer) return;
          const f = features.find((el) => el.get('data').labelCardId === data.labelCardId);
          if (!f) return;
          const featureData = f.get('data');
          const style = labelLayer.getStyle()(f);
          const text = style.getText();
          const blink = duration % 1 > 0.5;
          style.setImage(
            new Icon({
              anchor: showOld ? [12.5, 30] : [19, 45],
              anchorXUnits: 'pixels',
              anchorYUnits: 'pixels',
              scale: showOld ? 1 : blink ? 1 : 0.8,
              src: showOld
                ? PicMap[featureData.resourceType][featureData.status || 0]
                : data.type === 12
                ? label_sos
                : employee_alert,
            }),
          );
          if (text) {
            style.setText(
              new Text({
                text: text.text_,
                font: text.font_,
                fill: text.fill_,
                stroke: text.stroke_,
                offsetX: text.offsetX_,
                offsetY: showOld ? -40 : blink ? -55 : -44,
              }),
            );
          }
          f.setStyle(style);
          labelLayer.changed();
        });
        if (deleteAlert.length > 0) {
          setAlertInfo((prev) => prev.filter((item) => !deleteAlert.includes(item.reqId)));
        }
        if (alertInfoTimer.current && !alertInfo.length) {
          clearInterval(alertInfoTimer.current);
        }
      }, 250);
    }
    return () => {
      if (alertInfoTimer.current) {
        clearInterval(alertInfoTimer.current);
      }
    };
  }, [alertInfo, map, setAlertInfo]);

  return (
    <MapPortals>
      <div
        id="map-container"
        style={{
          background: '#163548',
          width: `${1920 * contentType}px`,
          height: `${Math.floor(1080 * contentType)}px`,
        }}
        ref={() => setHasDom(true)}
      >
        <div
          id="popup"
          className="member-ol-popup"
          style={{
            minWidth: '200px',
          }}
          ref={popupRef}
        >
          <a
            id="popup-closer"
            className="ol-popup-closer"
            onClick={() => {
              setLocationPosition(undefined);
              setInnerHtml('');
              popupOverlayRef.current?.set('isActive', false);
              popupOverlayRef.current?.setPosition(undefined);
            }}
          >
            <img src={close_button} alt="关闭" style={{ width: 20, height: 20 }} />
          </a>
          <div
            id="popup-content"
            ref={popupContentRef}
            dangerouslySetInnerHTML={{ __html: innerHtml }}
          />
        </div>
      </div>
      {stationDetail && <StationDetail {...{ stationDetail, setStationDetail }} />}
      {labelDetail && <LabelDetail {...{ labelDetail, setLabelDetail, mapAll }} />}
      {cameraDetail && <CameraDetail {...{ cameraDetail, setCameraDetail }} />}
    </MapPortals>
  );
};

export default React.memo(MapIndex);
