import React, { useImperativeHandle, useRef } from 'react';
import type { PopoverProps } from 'antd';
import { Popover } from 'antd';
import { useSetState } from 'ahooks';
import _ from 'lodash';

import close_button from '@/assets/images/monitoring/close_button.png';

export type PopoverWrapperInstance = {
  show: (arg: {
    width: number;
    height: number;
    left: number;
    top: number;
    titleText?: string;
  }) => void;
  hide: () => void;
  updateLocation: (arg: { left: number; top: number }) => void;
};
type IProps = PopoverProps & object;

const CesiumPopoverWrapper = React.forwardRef<PopoverWrapperInstance, IProps>((props, refs) => {
  const popoverBoxRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useSetState<{
    width: number;
    height: number;
    left: number;
    top: number;
    open: boolean;
    titleText: string;
  }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    open: false,
    titleText: '标题',
  });
  useImperativeHandle(
    refs,
    () => {
      return {
        show({ width, height, left, top, titleText = '标题' }) {
          if (popoverBoxRef.current) {
            popoverBoxRef.current.style.display = 'block';
            setState({
              width,
              height,
              left,
              top,
              open: true,
              titleText,
            });
          }
        },
        hide() {
          if (popoverBoxRef.current) {
            popoverBoxRef.current.style.display = 'none';
            setState({ open: false });
          }
        },
        updateLocation({ left, top }) {
          setState({ left, top });
        },
      };
    },
    [],
  );

  return (
    <Popover
      content={
        props.content || (
          <div>
            <p>cont</p>
            <p>cont</p>
            <p>cont</p>
          </div>
        )
      }
      title={
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{state.titleText}</span>
          <img onClick={() => setState({ open: false })} src={close_button} alt="" />
        </div>
      }
      open={_.isNil(props.open) ? state.open : props.open}
      getPopupContainer={() => popoverBoxRef.current as any}
      {...props}
    >
      <div
        ref={popoverBoxRef}
        id="popoverBox"
        style={{
          width: state.width,
          height: state.height,
          position: 'absolute',
          zIndex: 9999,
          display: 'none',
          top: state.top,
          left: state.left,
        }}
      />
    </Popover>
  );
});
CesiumPopoverWrapper.displayName = 'CesiumPopoverWrapper';
export default CesiumPopoverWrapper;
