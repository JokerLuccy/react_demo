// 标签详情
import { useState } from 'react';
import { useRequest } from 'umi';
import { Modal, Space, message } from 'antd';
import AlertIntrudeFence from '../AlertStatics/AlertIntrudeFence';
import AlertLowVoltage from '../AlertStatics/AlertLowVoltage';
import AlertLeaveFence from '../AlertStatics/AlertLeaveFence';
import AlertOffLine from '../AlertStatics/AlertOffLine';
import AlertOverTime from '../AlertStatics/AlertOverTime';
import AlertMotionless from '../AlertStatics/AlertMotionless';
import AlertFall from '../AlertStatics/AlertFall';
import AlertNoHelmet from '../AlertStatics/AlertNoHelmet';
import TracksModal from './TracksModal';
import {
  queryDetailLabelCard,
  queryListLabelCardHistoryTracksCurrent,
} from '@/services/monitoring';
import { alertEnum, LABEL_STATUS_ENUM, LABEL_STATUS_TEXT } from '@/constants/monitoring';
import { getFormatTime } from '@/utils/formatResult';
import close_button from '@/assets/images/monitoring/close_button.png';
import avatar_icon from '@/assets/images/monitoring/avatar.png';
import './StationDetail.less';
import './LabelDetail.less';
import AlertSos from '../AlertStatics/AlertSos';
import _ from 'lodash';

type LabelDetailProps = {
  labelDetail: API.LabelCardNewPosition;
  setLabelDetail: (data?: API.LabelCardNewPosition) => void;
  mapAll: API.MapGroupAll[];
};

const LabelDetail: React.FC<LabelDetailProps> = (props) => {
  const { labelDetail, setLabelDetail, mapAll } = props;
  const { data: detail } = useRequest(
    () => {
      if (labelDetail?.labelCardId) {
        return queryDetailLabelCard({ labelCardId: labelDetail.labelCardId });
      }
      return Promise.resolve();
    },
    {
      pollingInterval: 1000,
      refreshDeps: [labelDetail?.labelCardId],
      onError: () => {
        setLabelDetail(undefined);
      },
    },
  );
  const [resourceId, setResourceId] = useState<number>();
  const [openIntrudeFence, setOpenIntrudeFence] = useState<boolean>(false);
  const [openLowVoltage, setOpenLowVoltage] = useState<boolean>(false);
  const [openLeaveFence, setOpenLeaveFence] = useState<boolean>(false);
  const [openOffLine, setOpenOffLine] = useState<boolean>(false);
  const [openOverTime, setOpenOverTime] = useState<boolean>(false);
  const [openMotionless, setOpenMotionless] = useState<boolean>(false);
  const [openFall, setOpenFall] = useState<boolean>(false);
  const [openNoHelmet, setOpenNoHelmet] = useState<boolean>(false);
  const [openSosAlert, setOpenSosAlert] = useState<boolean>(false);
  const [trackDetail, setTrackDetail] = useState<
    API.LabelCardHistoryTracksModal & { resourceType?: number }
  >();
  const [loadingTrack, setLoadingTrack] = useState(false);

  const handleViewClick = (type: string) => {
    const setFun = {
      intrudeFenceAlertCount: setOpenIntrudeFence,
      lowVoltageAlertCount: setOpenLowVoltage,
      leaveFenceAlertCount: setOpenLeaveFence,
      offLineAlertCount: setOpenOffLine,
      overTimeAlertCount: setOpenOverTime,
      motionlessAlertCount: setOpenMotionless,
      fallAlertCount: setOpenFall,
      noHelmetAlertCount: setOpenNoHelmet,
      sosAlertCount: setOpenSosAlert,
    }[type];
    if (setFun) {
      setFun(true);
    }
  };

  const onLoadTrack = async () => {
    if (!detail?.labelCardId || loadingTrack) return;
    setLoadingTrack(true);
    const hide = message.loading({ content: '轨迹加载中', duration: 0 });
    try {
      const { data } =
        (await queryListLabelCardHistoryTracksCurrent({
          labelCardIds: [detail.labelCardId],
        })) || {};

      if (data?.length) {
        if (!data[0].labelTracks?.length) {
          message.warn({ content: '暂无轨迹', key: 'warn-tips' });
          return;
        }

        setTrackDetail({
          departmentNames: detail.departmentNames,
          professionName: detail.professionName,
          beginTime: data[0].labelTracks[0].devTime,
          ...data[0],
          resourceType: labelDetail.resourceType,
          queryTime: detail.queryTime || detail.currentTime,
        });
      }
    } catch (error) {
      // 查询轨迹错误
    } finally {
      hide();
      setLoadingTrack(false);
    }
  };

  // 员工详情
  if (labelDetail.resourceType === 1) {
    const informationData = [
      { id: 1, title: '姓名', value: detail?.name },
      { id: 2, title: '工号', value: detail?.resourceNo },
      { id: 3, title: '标签ID', value: detail?.labelCardId },
      { id: 4, title: '手机号', value: detail?.telephone },
    ];
    const detailsData = [
      {
        id: 1,
        title: '部门',
        value: detail?.departmentNames?.join('-') || '-',
      },
      {
        id: 2,
        title: '工种',
        value: detail?.professionName,
      },
    ];
    return (
      <>
        <Modal
          wrapClassName="person-detail-wrap"
          title="员工详情"
          open={!!LabelDetail}
          footer={null}
          centered
          destroyOnClose
          onCancel={() => {
            setLabelDetail(undefined);
          }}
          width={763}
          closeIcon={<img src={close_button} />}
        >
          {detail && (
            <div className="modal-body-container">
              <div className="left-container">
                <div className="avatar-block">
                  <div className="avatar-img">
                    <img
                      src={detail.photoPath || avatar_icon}
                      style={{ width: '90px', height: '85px' }}
                    />
                  </div>
                  <div className={detail.status === 0 ? 'online-status' : 'offline-status'}>
                    【
                    <a
                      style={{
                        color: {
                          [LABEL_STATUS_ENUM.ONLINE]: '#fff',
                          [LABEL_STATUS_ENUM.LOW]: '#ffab18',
                          [LABEL_STATUS_ENUM.OFFLINE]: 'red',
                        }[detail.status || 0],
                      }}
                    >
                      {LABEL_STATUS_TEXT[detail.status || 0]}
                    </a>
                    】
                  </div>
                </div>
                <div className="person-info-block">
                  {informationData.map((item) => {
                    return (
                      <div className="info-item-container" key={item.id}>
                        <div className="info-title">{item.title}</div>
                        <div className="info-value">{item.value}</div>
                      </div>
                    );
                  })}
                </div>
                <Space size={8} direction="vertical">
                  <div className="view-track" onClick={onLoadTrack}>
                    查看轨迹
                  </div>
                  <span>电量：{_.isNil(detail.voltage) ? '' : `${detail.voltage}%`}</span>
                </Space>
              </div>
              <div className="center-container">
                <div className="attendance-info-block">
                  <div className="attendance-header">考勤信息</div>
                  <div className="entry-duration">
                    <span className="entry-duration-title">入场时间</span>
                    <span className="entry-duration-value">{detail?.entryTime}</span>
                  </div>
                  <div className="entry-duration">
                    <span className="entry-duration-title">时长</span>
                    <span className="entry-duration-value">{getFormatTime(detail?.duration)}</span>
                  </div>
                  <div className="entry-duration">
                    <span className="entry-duration-title">最后活动时间</span>
                    <span className="entry-duration-value">{detail.devTime || '-'}</span>
                  </div>
                </div>
                <div className="detail-block">
                  <div className="detail-header">详细信息</div>
                  <div className="detail-info-block">
                    {detailsData.map((item) => {
                      return (
                        <div key={item.id} className="detail-info-item">
                          <span className="detail-info-item-title">{item.title}</span>
                          <span className="detail-info-item-value">{item.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="right-container">
                <div className="alert-block">
                  <div className="alert-info-header">报警信息</div>
                  {detail.alertNumber && (
                    <div className="alert-info-block">
                      {Object.keys(alertEnum)
                        .filter((item) => detail.alertNumber[item])
                        .map((item) => {
                          return (
                            <div key={item} className="alert-info-item">
                              <div>
                                <span className="alert-info-item-title">{alertEnum[item]}</span>
                                <span className="alert-info-item-value">
                                  (<a style={{ color: '#FFE244' }}>{detail.alertNumber[item]}</a>)
                                </span>
                              </div>
                              <div
                                className="view"
                                style={{ color: '#1bddff', cursor: 'default' }}
                                onClick={() => {
                                  setResourceId(detail.resourceId);
                                  handleViewClick(item);
                                }}
                              >
                                查看
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
        <AlertIntrudeFence
          {...{ open: openIntrudeFence, setOpen: setOpenIntrudeFence, resourceId }}
        />
        <AlertLowVoltage {...{ open: openLowVoltage, setOpen: setOpenLowVoltage, resourceId }} />
        <AlertLeaveFence {...{ open: openLeaveFence, setOpen: setOpenLeaveFence, resourceId }} />
        <AlertOffLine {...{ open: openOffLine, setOpen: setOpenOffLine, resourceId }} />
        <AlertOverTime {...{ open: openOverTime, setOpen: setOpenOverTime, resourceId }} />
        <AlertMotionless {...{ open: openMotionless, setOpen: setOpenMotionless, resourceId }} />
        <AlertFall {...{ open: openFall, setOpen: setOpenFall, resourceId }} />
        <AlertNoHelmet {...{ open: openNoHelmet, setOpen: setOpenNoHelmet, resourceId }} />
        <AlertSos {...{ open: openSosAlert, setOpen: setOpenSosAlert, resourceId }} />
        {trackDetail && (
          <TracksModal {...{ detail: trackDetail, setDetail: setTrackDetail, mapAll }} />
        )}
      </>
    );
  }

  if (labelDetail.resourceType === 2) {
    const informationData = [
      { id: 1, title: '姓名', value: detail?.name },
      { id: 3, title: '标签ID', value: detail?.labelCardId },
      { id: 4, title: '手机号', value: detail?.telephone },
    ];
    return (
      <>
        <Modal
          wrapClassName="person-detail-wrap visitor-detail-wrap"
          title="访客详情"
          open={!!LabelDetail}
          footer={null}
          centered
          destroyOnClose
          onCancel={() => {
            setLabelDetail(undefined);
          }}
          width={520}
          closeIcon={<img src={close_button} />}
        >
          {detail && (
            <div className="modal-body-container">
              <div className="center-container">
                <div className="detail-block">
                  <div className="detail-header">基础信息</div>
                  <div className="detail-info-block">
                    {informationData.map((item) => {
                      return (
                        <div key={item.id} className="detail-info-item">
                          <span className="detail-info-item-title">{item.title}</span>
                          <span className="detail-info-item-value">{item.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="attendance-info-block">
                  <div
                    className="attendance-header"
                    style={{ width: 'max-content', padding: '0 18px' }}
                  >
                    最新入场信息
                  </div>
                  <div className="entry-duration">
                    <span className="entry-duration-title">入场时间</span>
                    <span className="entry-duration-value">{detail?.entryTime}</span>
                  </div>
                  <div className="entry-duration">
                    <span className="entry-duration-title">入场时长</span>
                    <span className="entry-duration-value">{getFormatTime(detail?.duration)}</span>
                  </div>
                  <div className="entry-duration">
                    <span className="entry-duration-title">最后活动时间</span>
                    <span className="entry-duration-value">{detail.devTime || '-'}</span>
                  </div>
                </div>
              </div>
              <div className="right-container">
                <div className="alert-block">
                  <div className="alert-info-header">报警信息</div>
                  {detail.alertNumber && (
                    <div className="alert-info-block">
                      {Object.keys(alertEnum)
                        .filter((item) => detail.alertNumber[item])
                        .map((item) => {
                          return (
                            <div key={item} className="alert-info-item">
                              <div>
                                <span className="alert-info-item-title">{alertEnum[item]}</span>
                                <span className="alert-info-item-value">
                                  (<a style={{ color: '#FFE244' }}>{detail.alertNumber[item]}</a>)
                                </span>
                              </div>
                              <div
                                className="view"
                                style={{ color: '#1bddff', cursor: 'default' }}
                                onClick={() => {
                                  setResourceId(detail.resourceId);
                                  handleViewClick(item);
                                }}
                              >
                                查看
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                <Space direction="vertical">
                  <div className="view-track" onClick={onLoadTrack}>
                    查看轨迹
                  </div>
                  <span>电量：{_.isNil(detail.voltage) ? '' : `${detail.voltage}%`}</span>
                </Space>
              </div>
            </div>
          )}
        </Modal>
        <AlertIntrudeFence
          {...{ open: openIntrudeFence, setOpen: setOpenIntrudeFence, resourceId }}
        />
        <AlertLowVoltage {...{ open: openLowVoltage, setOpen: setOpenLowVoltage, resourceId }} />
        <AlertLeaveFence {...{ open: openLeaveFence, setOpen: setOpenLeaveFence, resourceId }} />
        <AlertOffLine {...{ open: openOffLine, setOpen: setOpenOffLine, resourceId }} />
        <AlertOverTime {...{ open: openOverTime, setOpen: setOpenOverTime, resourceId }} />
        <AlertMotionless {...{ open: openMotionless, setOpen: setOpenMotionless, resourceId }} />
        <AlertFall {...{ open: openFall, setOpen: setOpenFall, resourceId }} />
        <AlertNoHelmet {...{ open: openNoHelmet, setOpen: setOpenNoHelmet, resourceId }} />
        {trackDetail && (
          <TracksModal {...{ detail: trackDetail, setDetail: setTrackDetail, mapAll }} />
        )}
      </>
    );
  }

  // 车辆详情
  const carData = [
    { name: detail?.name || '-', title: '车辆名称' },
    { name: detail?.labelCardId || '-', title: '标签ID' },
    { name: detail?.departmentNames?.join('-') || '-', title: '部门' },
    { name: detail?.carType || '-', title: '类型' },
    { name: detail?.resourceNo || '-', title: '车辆编号' },
    { name: `${detail?.voltage || 0}%`, title: '电量' },
    { name: detail?.entryTime || '-', title: '进场时间' },
    { name: getFormatTime(detail?.duration || 0), title: '时长' },
    {
      name: LABEL_STATUS_TEXT[detail?.status || 0],
      title: '状态',
    },
  ];
  return (
    <Modal
      wrapClassName="visualization-wrap-modal-class"
      title="车辆详情"
      open={!!labelDetail}
      footer={null}
      centered
      destroyOnClose
      onCancel={() => {
        setLabelDetail(undefined);
      }}
      width={273}
      closeIcon={<img src={close_button} />}
    >
      <div className="station-detail-container">
        {carData.map((item) => {
          return (
            <div key={item.title} className="station-detail-content">
              <div className="station-title-item">{item.title}</div>
              <div className="station-content-item">{item.name}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default LabelDetail;
