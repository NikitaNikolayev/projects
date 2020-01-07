/* eslint react/destructuring-assignment: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'antd';
import classNames from 'classnames';
import { Resizable } from 'react-resizable';
import './style.less';

export function ResizeableTitle(props) {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      axis="x"
      onResize={onResize}
      minConstraints={[60, 0]}
      maxConstraints={[800, 0]}
    >
      <th {...restProps} />
    </Resizable>
  );
}

ResizeableTitle.propTypes = {
  onResize: PropTypes.func,
  width: PropTypes.number,
};

class DataTable extends React.Component {
  static propTypes = {
    baseCls: PropTypes.string,
    scrollOffset: PropTypes.number,
    dataSource: PropTypes.arrayOf(PropTypes.shape({})),
    toolbarActions: PropTypes.oneOfType([PropTypes.node, PropTypes.arrayOf(PropTypes.node)]),
    toolbarExtra: PropTypes.node,
    bulkActions: PropTypes.oneOfType([PropTypes.node, PropTypes.arrayOf(PropTypes.node)]),
    selectedRowKeys: PropTypes.arrayOf(PropTypes.string),
    onDeselectRows: PropTypes.func,
    cardView: PropTypes.bool,
    fixedBody: PropTypes.bool,
    total: PropTypes.node,
    showToolbar: PropTypes.bool,
    minWidth: PropTypes.number,
  }

  static defaultProps = {
    baseCls: 'welo-data-table',
    fixedBody: true,
    showToolbar: true,
    cardView: true,
    scrollOffset: 274,
  }

  state = {
    scrollY: null,
    tableColumns: [],
  }

  componentDidMount() {
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      this.setState({ scrollY: window.innerHeight - this.props.scrollOffset });
      window.addEventListener('resize', this.onResize, false);
    }
    this.initColumnState(this.props.columns);
  }

  componentWillReceiveProps(nextProps) {
    if (!this.isSameColumns(nextProps.columns, this.props.columns)) {
      this.initColumnState(nextProps.columns);
    }
    if (nextProps.scrollOffset !== this.props.scrollOffset) {
      this.setState({ scrollY: window.innerHeight - nextProps.scrollOffset });
    }
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }

  onResize = () => {
    if (typeof window !== 'undefined') {
      this.setState({ scrollY: window.innerHeight - this.props.scrollOffset });
    }
  }

  isSameColumns = (nextColumns, currColumns) => {
    if (nextColumns === currColumns) {
      return true;
    } if (nextColumns.length === currColumns.length) {
      for (let i = 0; i < nextColumns.length; i++) {
        if (nextColumns[i] !== currColumns[i]) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  handleColumnResize = index => (e, { size }) => {
    this.setState(({ tableColumns }) => {
      const nextColumns = [...tableColumns];
      nextColumns[index] = {
        ...nextColumns[index],
        width: size.width,
      };
      return { tableColumns: nextColumns };
    });
  };

  handleTableChange = (pagination, filters, sorter) => {
    const { onChange } = this.props;
    if (onChange) {
      onChange(pagination, filters, sorter);
    }
  }

  initColumnState = (columns) => {
    const tableColumns = columns.map((column, index) => ({
      ...column,
      index,
    }));
    this.setState({
      tableColumns,
    });
  }

  render() {
    const {
      baseCls, cardView, fixedBody, minWidth,
      selectedRowKeys, onDeselectRows, bulkActions, rowSelection,
      showToolbar, toolbarActions, toolbarExtra, dataSource,
    } = this.props;
    let scrollProp;
    if (this.state.scrollY) {
      scrollProp = this.props.scroll ? { ...this.props.scroll, y: this.state.scrollY }
        : {
          x: (dataSource && dataSource.length === 0) ? false
            : (minWidth || (this.state.tableColumns.reduce((acc, cur) => acc
          + (cur.width ? cur.width : 100), 0))),
          y: this.state.scrollY,
        };
    }
    const classes = classNames(baseCls, {
      [`${baseCls}-no-border`]: !cardView,
    });
    const bodyClasses = classNames(`${baseCls}-body`, {
      [`${baseCls}-body-fixed`]: fixedBody,
    });
    const columns = this.state.tableColumns.map((col, index) => ({
      ...col,
      onHeaderCell: (column) => {
        if (!column.fixed || column.fixed === 'left') {
          return ({
            width: column.width,
            onResize: this.handleColumnResize(index),
          });
        }
        return {};
      },
    }));
    if (rowSelection && rowSelection.fixed === undefined) {
      rowSelection.fixed = true;
    }
    return (
      <div className={classes}>
        {showToolbar
        && (
        <div className={`${baseCls}-toolbar`}>
          {toolbarActions}
          {toolbarExtra}
        </div>
        )}
        <div className={bodyClasses}>
          <Table
            {...this.props}
            dataSource={dataSource}
            onChange={this.handleTableChange}
            scroll={scrollProp}
            columns={columns}
            components={{
              header: {
                cell: ResizeableTitle,
              },
            }}
          />
          {selectedRowKeys
            && (
            <div className={`${baseCls}-body-row-selection ${selectedRowKeys.length === 0 ? 'hide' : ''}`}>
              <h4 className={`${baseCls}-body-row-selection-text`}>
                已选中
                {' '}
                <b>{selectedRowKeys.length}</b>
                {' '}
                项
              </h4>
              <a onClick={onDeselectRows}>取消</a>
              {bulkActions}
            </div>
            )}
          {this.props.total}
        </div>
      </div>
    );
  }
}

export default DataTable;
