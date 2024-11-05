import ReactDOM from 'react-dom';

const MapPortals: React.FC = (props) => {
  const modalRoot = document.getElementById('map-root');
  if (!modalRoot) return null;
  return ReactDOM.createPortal(
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {props.children}
    </div>,
    modalRoot,
  );
};

export default MapPortals;
