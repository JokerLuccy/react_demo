// 轨迹动画
import React, { useEffect, useState, useRef } from 'react';
import { Modal, Space, Select, Button, Row, Col, Slider, Popover, Cascader, message } from 'antd';
import { ProForm, ProFormDateTimeRangePicker } from '@ant-design/pro-components';
import type { Moment } from 'moment';
import moment from 'moment';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import { Point, LineString } from 'ol/geom';
import { Fill, Stroke, Style, Icon, Text } from 'ol/style';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { defaults as defaultControls } from 'ol/control';
import { getMapIdValue, renderMapFiles } from '@/helpers/map';
import { getLocation, showEndLocationType } from '@/helpers/alert';
import { SPEED_ENUM, getSliderMax, getTrackPoint } from '@/helpers/track';
import type { ProFormInstance } from '@ant-design/pro-components';
import close_button from '@/assets/images/monitoring/close_button.png';
import track_pause from '@/assets/images/track_pause.png';
import track_play from '@/assets/images/track_play.png';
import track_replay from '@/assets/images/track_replay.png';
import track_add from '@/assets/images/track_add.png';
import track_reduce from '@/assets/images/track_reduce.png';
import track_add_light from '@/assets/images/track_add_light.png';
import track_reduce_light from '@/assets/images/track_reduce_light.png';
import locationIcon from '@/assets/images/legend/label_online.svg';
import './TracksModal.less';
import type { DefaultOptionType } from 'antd/es/cascader';
import { useModel } from 'umi';
import classNames from 'classnames';
import { useDeepCompareEffect } from 'ahooks';

const getShowTrackList = ({ time, trackList }: { time?: string; trackList: API.LabelTrack[] }) => {
  if (!time) return trackList;
  let showList = trackList || [];
  const timeRange = time.split('~');
  if (timeRange.length === 2 && trackList.length > 0) {
    // 限制在时间范围之内
    showList = trackList.filter((item) => {
      return (
        moment(item.devTime).valueOf() >= moment(timeRange[0]).valueOf() &&
        moment(item.devTime).valueOf() <= moment(timeRange[1]).valueOf()
      );
    });
  }
  return showList;
};

type TracksModalProps = {
  alertDetail?: API.AlertRecordTrackParams;
  detail: API.LabelCardHistoryTracksModal & { resourceType?: number };
  setDetail: (bool?: API.LabelCardHistoryTracksModal) => void;
  mapAll?: API.MapGroupAll[];
  /** 是否是报警统计弹窗 */
  isAlertTrack?: boolean;
};

const TracksModal: React.FC<TracksModalProps> = (props) => {
  const { detail, setDetail, mapAll = [], isAlertTrack, alertDetail } = props;
  const timerRef = useRef<NodeJS.Timer>();
  const formRef = useRef<ProFormInstance>();
  const [map, setMap] = useState<Map>();
  const [hasDom, setHasDom] = useState<boolean>(false);
  const [mapId, setMapId] = useState<number | undefined>();
  const [animating, setAnimating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [timeList, setTimeList] = useState<string[]>([]);
  const [selectStartTime, setSelectStartTime] = useState<string>();
  const [speed, setSpeed] = useState<number>(1);
  const speedRef = useRef<number>(1);
  const selectTimeRangeRef = useRef<string>();
  const [showLocation, setShowLocation] = useState<boolean>(false);
  const { initialState } = useModel('@@initialState');

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    // 时间范围
    selectTimeRangeRef.current = selectStartTime;
  }, [selectStartTime]);

  const handleSpliceTimeRange = (timeRange: string[]) => {
    const newTimeList = [];
    for (let i = 0; i < 24; i++) {
      if (moment(timeRange[0]).add(i, 'h').valueOf() < moment(timeRange[1]).valueOf()) {
        let endTime: Moment | string = moment(timeRange[0]).add(i + 1, 'h');
        if (endTime.valueOf() > moment(timeRange[1]).valueOf()) {
          endTime = timeRange[1];
        } else {
          endTime = endTime.format('YYYY-MM-DD HH:mm:ss');
        }
        newTimeList.push(
          `${moment(timeRange[0]).add(i, 'h').format('YYYY-MM-DD HH:mm:ss')}~${endTime}`,
        );
      }
    }
    if (selectStartTime !== newTimeList[0]) {
      setAnimating(false);
      setTimeList(newTimeList);
      setMapId(undefined);
      setSelectStartTime(newTimeList[0]);
    }
  };

  // 初始化时间段
  useEffect(() => {
    if (!detail) return;
    const initTrackParams = async () => {
      const { beginTime, queryTime } = detail;
      const params = {
        startTime: moment(beginTime).format('YYYY-MM-DD HH:mm:ss'),
        endTime: moment(queryTime).format('YYYY-MM-DD HH:mm:ss'),
      };
      formRef.current?.setFieldsValue({
        timeRange: [
          moment(params.startTime).format('YYYY-MM-DD HH:mm:ss'),
          moment(params.endTime).format('YYYY-MM-DD HH:mm:ss'),
        ],
      });
      const newTimeList = [`${params.startTime}~${params.endTime}`];
      setTimeList(newTimeList);
      setMapId(undefined);
      setSelectStartTime(newTimeList[0]);
      handleSpliceTimeRange([params.startTime, params.endTime]);
    };
    initTrackParams();
  }, [detail]);

  // 获取轨迹数据
  useEffect(() => {
    if (!selectStartTime || !detail) return;
    const { labelTracks = [] } = detail;
    if (isAlertTrack && alertDetail) {
      if (!labelTracks?.length) {
        message.warn({ content: '没有轨迹信息', key: 'track-tips', style: { zIndex: 1100 } });
        setMapId(
          showEndLocationType.includes(alertDetail?.type as number)
            ? alertDetail?.endMapId
            : alertDetail?.mapId,
        );
        setShowLocation(true);
      } else {
        setMapId((prevId) => labelTracks[0]?.mapId || prevId);
      }
    } else {
      setMapId((prevId) => {
        const nextMapId =
          getShowTrackList({ time: selectStartTime, trackList: labelTracks })[0]?.mapId || prevId;
        if (!nextMapId) {
          message.warn({ content: '没有轨迹信息', key: 'track-tips', style: { zIndex: 1100 } });
        }
        return nextMapId;
      });
    }
  }, [detail, selectStartTime, isAlertTrack, alertDetail]);

  // 不存在轨迹时显示定位
  useEffect(() => {
    if (!map || !showLocation) return;
    const location = getLocation(alertDetail);
    const iconFeature = new Feature({
      geometry: location[0] !== undefined ? new Point(location) : undefined,
    });
    const iconStyle = new Style({
      image: new Icon({
        anchor: [12.5, 30],
        size: [25, 30],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        src: locationIcon,
      }),
      text: new Text({
        text: alertDetail?.name || '',
        font: 'normal 12px sans-serif',
        fill: new Fill({
          color: '#000',
        }),
        stroke: new Stroke({
          color: '#fff',
          width: 2,
        }),
        offsetX: 0,
        offsetY: -36,
      }),
    });
    iconFeature.setStyle(iconStyle);
    const vectorSource = new VectorSource({
      features: [iconFeature],
    });
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      zIndex: 10,
    });
    vectorLayer.set('layerId', 'alertLocation');
    map.addLayer(vectorLayer);
  }, [alertDetail, map, showLocation]);

  // 历史轨迹
  useEffect(() => {
    if (!map || !detail || showLocation) return;
    const { labelTracks = [], resourceType, professionColor } = detail;

    const features: Feature<LineString | Point>[] = [];
    const labelTracksLines: API.LabelTrack[][] = [[]];
    getShowTrackList({ time: selectTimeRangeRef.current, trackList: labelTracks }).forEach(
      (item, index, array) => {
        if (!item || item.mapId !== mapId) return;

        if (!labelTracksLines[0][0]) {
          labelTracksLines[0].push(item);
        } else {
          if (array[index - 1]?.mapId !== mapId) {
            labelTracksLines[labelTracksLines.length] = [item];
          } else {
            labelTracksLines[labelTracksLines.length - 1].push(item);
          }
        }
      },
    );

    if ((labelTracksLines[0].length === 0 && mapId) || labelTracks.length === 0) {
      message.warn({ content: '没有轨迹信息', key: 'track-tips', style: { zIndex: 1100 } });
    }

    labelTracksLines.forEach((item) => {
      if (!item) return;
      const feature = new Feature({
        geometry: new LineString(item.map((el) => [el.locationX, el.locationY, el.locationZ])),
      });
      features.push(feature);
    });
    if (labelTracksLines[0][0]) {
      const feature = new Feature({
        geometry: new Point([
          labelTracksLines[0][0].locationX,
          labelTracksLines[0][0].locationY,
          labelTracksLines[0][0].locationZ,
        ]),
      });
      feature.set('trackKey', 'labelTracks');
      features.push(feature);
    }

    const vectorSource = new VectorSource({
      features: features,
    });
    const layers = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        let color = '#ff0000';
        if (resourceType === 1) {
          color = professionColor || color;
        }
        if (resourceType === 2) {
          color = initialState?.serverTrackVisitorColor || color;
        }
        if (resourceType === 3) {
          color = initialState?.serverTrackVehicleColor || color;
        }
        const type = feature.getGeometry()?.getType();
        if (type === 'Point') {
          return new Style({
            image: new Icon({
              anchor: [12.5, 30],
              size: [25, 30],
              anchorXUnits: 'pixels',
              anchorYUnits: 'pixels',
              src: locationIcon,
            }),
            text: new Text({
              text: detail.name || detail.labelCardId || '',
              font: 'normal 12px sans-serif',
              fill: new Fill({
                color: '#000',
              }),
              stroke: new Stroke({
                color: '#fff',
                width: 2,
              }),
              offsetX: 0,
              offsetY: -36,
            }),
          });
        }
        return new Style({
          stroke: new Stroke({
            width: 2,
            color: color,
          }),
        });
      },
      zIndex: 10,
    });
    layers.set('layerId', 'track');

    let hasLayer = false;
    map.getAllLayers().forEach((item) => {
      if (item.get('layerId') === 'track') {
        hasLayer = true;
        item.setSource(vectorSource);
        item.changed();
      }
    });
    if (!hasLayer) {
      map.addLayer(layers);
    }
  }, [
    map,
    mapId,
    detail,
    showLocation,
    initialState?.serverTrackVisitorColor,
    initialState?.serverTrackVehicleColor,
  ]);

  // 生成地图
  useEffect(() => {
    if (!hasDom) return;
    const mapContent = new Map({
      target: 'map-container-track',
      controls: defaultControls({ zoom: false }),
      view: new View({}),
    });
    setMap(mapContent);

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

  const clearCurrentInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  };

  // 动画
  useEffect(() => {
    clearCurrentInterval();
    if (!map) return;
    const layer = map.getAllLayers().find((item) => item.get('layerId') === 'track');
    if (!layer) return;
    if (animating) {
      const showTrackList = getShowTrackList({
        time: selectTimeRangeRef.current,
        trackList: detail.labelTracks,
      });
      timerRef.current = setInterval(() => {
        const source = layer.getSource();
        const features: Feature<LineString | Point>[] = source?.getFeatures();
        setProgress((prev) => {
          let next = Number((prev + 1).toFixed(2));
          const trackPoint = features.find((item) => item.get('trackKey'));

          if (trackPoint && detail && detail.labelTracks) {
            if (next >= getSliderMax(selectTimeRangeRef.current)) {
              next = getSliderMax(selectTimeRangeRef.current);
              clearInterval(timerRef.current);
              timerRef.current = undefined;
              setAnimating(false);
            }
            const currentPoint = getTrackPoint({
              trackList: showTrackList,
              progress: next,
              time: selectTimeRangeRef.current,
            });
            if (currentPoint) {
              setMapId((prevId) => currentPoint.mapId || prevId);
              trackPoint.setGeometry(
                new Point([currentPoint.locationX, currentPoint.locationY, currentPoint.locationZ]),
              );
            }
          }
          source?.changed();
          return next;
        });
      }, Math.floor(1000 / speed));
    } else {
      clearCurrentInterval();
    }
    return () => {
      clearCurrentInterval();
    };
  }, [map, animating, detail, speed]);

  return (
    <Modal
      title="轨迹动画"
      open={true}
      centered={true}
      destroyOnClose={true}
      onCancel={() => setDetail(undefined)}
      width="max-content"
      maskClosable={false}
      wrapClassName="track-wrap-class unify-wrap-modal-class"
      className="history-tracks-modal"
      closeIcon={<img src={close_button} />}
      bodyStyle={{ width: 'max-content', padding: '6px 12px' }}
      footer={false}
    >
      <div style={{ display: isAlertTrack ? 'none' : 'block' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col span={8}>姓名：{detail?.name}</Col>
          <Col span={8}>标签ID：{detail?.labelCardId}</Col>
          <Col span={8}>工号：{detail?.resourceNo}</Col>
          <Col span={8}>部门：{detail?.departmentNames?.join('-')}</Col>
          <Col span={8}>工种：{detail?.professionName}</Col>
        </Row>
        <Space size={[48, 12]} wrap>
          <div>
            轨迹开始时间：
            {detail?.beginTime ? moment(detail?.beginTime).format('YYYY-MM-DD HH:mm:ss') : '--'}
          </div>
          <div>
            轨迹结束时间：
            {detail?.queryTime ? moment(detail?.queryTime).format('YYYY-MM-DD HH:mm:ss') : '--'}
          </div>
        </Space>
        <ProForm
          className="ant-form-custom ant-form-track"
          autoFocusFirstInput={false}
          omitNil={false}
          formRef={formRef}
          // onValuesChange={(changedValues) => {
          //   const keys = Object.keys(changedValues);
          //   if (keys.includes('timeRange')) {
          //     const { beginTime, queryTime } = detail;
          //     if (!changedValues.timeRange) {
          //       let endTime = moment(beginTime).add(1, 'h');
          //       if (endTime.valueOf() > moment(queryTime).valueOf()) {
          //         endTime = moment(queryTime);
          //       }
          //       formRef.current?.setFieldValue('timeRange', [
          //         moment(beginTime),
          //         endTime.format('YYYY-MM-DD HH:mm:ss'),
          //       ]);
          //     } else {
          //       const { timeRange } = changedValues;
          //       // 限制在时间范围内
          //       if (moment(timeRange[0]).valueOf() < moment(beginTime).valueOf()) {
          //         timeRange[0] = moment(beginTime).format('YYYY-MM-DD HH:mm:ss');
          //       }
          //       if (moment(timeRange[1]).valueOf() > moment(queryTime).valueOf()) {
          //         timeRange[1] = moment(queryTime).format('YYYY-MM-DD HH:mm:ss');
          //       }
          //       // 限制在24小时内
          //       if (moment(timeRange[0]).add(1, 'd').valueOf() < moment(timeRange[1]).valueOf()) {
          //         timeRange[1] = moment(timeRange[0]).add(1, 'd').format('YYYY-MM-DD HH:mm:ss');
          //       }
          //       formRef.current?.setFieldValue('timeRange', timeRange);
          //     }
          //   }
          // }}
          colon={false}
          layout="inline"
          submitter={false}
          style={{ width: '100%', margin: '20px 0 20px' }}
          size="small"
        >
          <ProFormDateTimeRangePicker
            name="timeRange"
            label={<div style={{ fontSize: '14px', color: '#cee2ff' }}>播放时间段</div>}
            fieldProps={{
              allowClear: false,
              dropdownClassName: 'time-picker-custom',
              disabledDate(currentDate) {
                return (
                  currentDate.isBefore(detail.beginTime) || currentDate.isAfter(detail.queryTime)
                );
              },
              onCalendarChange(values, formatString, { range }) {
                if (range === 'end') {
                  handleSpliceTimeRange(formatString);
                }
              },
            }}
          />
        </ProForm>
      </div>
      <div
        id="map-container-track"
        className="map-common"
        style={{
          width: '80vw',
          height: isAlertTrack ? 'calc(100vh - 150px)' : 'calc(100vh - 300px)',
        }}
        ref={() => setHasDom(true)}
      >
        <div className="track-select-container unify-wrap-modal-class warp-modal-count-class">
          <Cascader
            options={mapAll.filter((item) => item.maps?.length)}
            value={getMapIdValue({ mapAll, mapId })}
            style={{
              minWidth: 200,
              width: 'max-content',
              maxWidth: 400,
              pointerEvents: isAlertTrack ? 'none' : 'auto',
            }}
            className="cascader-reset-style"
            dropdownClassName="cascader-reset-style"
            fieldNames={{ label: 'name', value: 'id', children: 'maps' }}
            onChange={(value) => {
              setMapId(value[value.length - 1] as number);
            }}
            allowClear={false}
            placeholder="请选择"
            placement="bottomLeft"
            showArrow={!isAlertTrack}
            showSearch={{
              filter: (inputValue: string, path: DefaultOptionType[]) =>
                path.some(
                  (option) =>
                    (option.name as string).toLowerCase().indexOf(inputValue.toLowerCase()) > -1,
                ),
            }}
          />
        </div>
      </div>
      <div
        style={{ padding: '5px 48px', display: showLocation ? 'none' : 'block' }}
        className="attendance-track-player"
      >
        <Row justify="center" align="middle" gutter={[12, 0]}>
          <Col flex={1}>
            <Slider
              max={getSliderMax(selectStartTime)}
              value={progress}
              onChange={(val) => {
                if (!map) return;
                setProgress(val);
                const layer = map.getAllLayers().find((item) => item.get('layerId') === 'track');
                if (!layer) return;
                const source = layer.getSource();
                const features: Feature<LineString | Point>[] = source?.getFeatures();
                const trackPoint = features.find((item) => item.get('trackKey'));
                const trackKey = trackPoint?.get('trackKey');
                if (trackPoint && detail && detail[trackKey]) {
                  const currentPoint = getTrackPoint({
                    trackList: getShowTrackList({
                      time: selectTimeRangeRef.current,
                      trackList: detail[trackKey],
                    }),
                    progress: val,
                    time: selectTimeRangeRef.current,
                  });
                  if (currentPoint) {
                    setMapId((prevId) => currentPoint.mapId || prevId);
                    trackPoint.setGeometry(
                      new Point([
                        currentPoint.locationX,
                        currentPoint.locationY,
                        currentPoint.locationZ,
                      ]),
                    );
                  }
                }
                source?.changed();
              }}
              tooltip={{
                formatter: (val) => {
                  if (selectStartTime) {
                    return moment(selectStartTime.split('~')[0])
                      .add(val, 's')
                      .format('YYYY-MM-DD HH:mm:ss');
                  }
                  return val;
                },
              }}
            />
          </Col>
        </Row>
        <Row
          gutter={[10, 10]}
          // justify="space-between"
          align="top"
          wrap={false}
          style={{ marginTop: '10px', userSelect: 'none' }}
        >
          <Col span={13}>
            <Space
              wrap
              align="start"
              size={4}
              style={{ height: 60, overflowY: 'auto', 'scrollbar-color': '#9ceaff transparent' }}
            >
              {timeList.map((item) => {
                const itemList = item.split('~');
                return (
                  <div
                    onClick={() => {
                      setAnimating(false);
                      setProgress(0);
                      setMapId(undefined);
                      setSelectStartTime(item);
                    }}
                    key={item}
                    className={classNames('select-time', {
                      'active-select-time': item === selectStartTime,
                      'default-select-item': item !== selectStartTime,
                    })}
                  >
                    {moment(itemList[0]).format('HH:mm:ss')}~
                    {moment(itemList[1]).format('HH:mm:ss')}
                  </div>
                );
              })}
            </Space>
          </Col>
          <Col span={7} className="player-speed">
            <span style={{ whiteSpace: 'nowrap' }}>倍速</span>
            <span
              onClick={() => {
                SPEED_ENUM.forEach((item, index) => {
                  if (item === speed && index !== 0) {
                    setSpeed(SPEED_ENUM[index - 1]);
                  }
                });
              }}
            >
              <img
                src={speed === 1 ? track_reduce : track_reduce_light}
                style={{ width: 31, height: 31, pointerEvents: 'none' }}
              />
            </span>
            <Select
              popupClassName="player-drop-down"
              size="small"
              style={{ width: 60 }}
              showArrow={false}
              dropdownMatchSelectWidth={80}
              dropdownStyle={{ backgroundColor: 'rgba(1, 13, 26, 0.64)', textAlign: 'center' }}
              options={SPEED_ENUM.map((item) => ({ label: item + 'X', value: item }))}
              value={speed}
              onChange={(val) => {
                speedRef.current = val;
                setSpeed(speedRef.current);
              }}
            />
            <span
              onClick={() => {
                SPEED_ENUM.forEach((item, index) => {
                  if (item === speed && index !== SPEED_ENUM.length - 1) {
                    setSpeed(SPEED_ENUM[index + 1]);
                  }
                });
              }}
            >
              <img
                src={speed === SPEED_ENUM[SPEED_ENUM.length - 1] ? track_add : track_add_light}
                style={{ width: 31, height: 31, pointerEvents: 'none' }}
              />
            </span>
          </Col>
          <Col span={4}>
            <span
              onClick={() => {
                setAnimating(!animating);
              }}
              style={{ marginRight: 12, cursor: 'pointer' }}
            >
              <img
                src={animating ? track_pause : track_play}
                style={{ width: 25, pointerEvents: 'none' }}
              />
            </span>
            <span
              onClick={() => {
                setProgress(0);
                setAnimating(true);
              }}
              style={{ cursor: 'pointer' }}
            >
              <img src={track_replay} style={{ width: 25, pointerEvents: 'none' }} />
            </span>
          </Col>
        </Row>
      </div>
    </Modal>
  );
};

export default React.memo(TracksModal);
