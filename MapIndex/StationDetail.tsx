// 基站详情
import React from 'react';
import { Modal } from 'antd';
import close_button from '@/assets/images/monitoring/close_button.png';
import './StationDetail.less';

type StationDetailProps = {
  stationDetail: API.StationPosition;
  setStationDetail: (data?: API.StationPosition) => void;
};

const StationDetail: React.FC<StationDetailProps> = (props) => {
  const { stationDetail, setStationDetail } = props;

  const stationData = [
    { id: 1, name: stationDetail.stationName || '-', title: '基站名称' },
    { id: 2, name: stationDetail.stationId || '-', title: '基站编码' },
    { id: 3, name: stationDetail.locationName || '-', title: '位置名称' },
    { id: 8, name: { 0: '在线', 1: '离线' }[stationDetail.status] || '-', title: '基站状态' },
  ];

  return (
    <Modal
      wrapClassName="visualization-wrap-modal-class"
      title="基站详情"
      open={!!stationDetail}
      footer={null}
      centered
      destroyOnClose
      onCancel={() => {
        setStationDetail(undefined);
      }}
      width={273}
      closeIcon={<img src={close_button} />}
    >
      <div className="station-detail-container">
        {stationData.map((item) => {
          return (
            <div key={item?.id} className="station-detail-content">
              <div className="station-title-item">{item.title}</div>
              <div className="station-content-item">{item.name}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default React.memo(StationDetail);
