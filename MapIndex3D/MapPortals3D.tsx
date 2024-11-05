import ReactDOM from 'react-dom';

const MapPortals3D: React.FC = (props) => {
  const modalRoot = document.getElementById('cesium-root');
  if (!modalRoot) return null;
  return ReactDOM.createPortal(
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxSizing: 'border-box',
        paddingTop: 10,
      }}
    >
      {props.children}
    </div>,
    modalRoot,
  );
};

export default MapPortals3D;
