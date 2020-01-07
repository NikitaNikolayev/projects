import React from 'react';
import { render } from 'react-dom';
import { Result } from 'antd';
import * as Sentry from '@sentry/browser';
import RootContainer from './container/root';

Sentry.init({ dsn: 'https://2e0c7628e7a9477a88508ab1f16ee88a@sentry.io/1504096' });

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  // eslint-disable-next-line no-unused-vars
  componentDidCatch(error, info) {
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="500"
          subTitle="抱歉，系统出错了"
        />
      );
    }
    return this.props.children;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  render(<ErrorBoundary><RootContainer /></ErrorBoundary>, document.getElementById('mount'));
});
