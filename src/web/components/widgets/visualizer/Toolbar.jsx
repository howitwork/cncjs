import _ from 'lodash';
import i18n from '../../../lib/i18n';
import pubsub from 'pubsub-js';
import React from 'react';
import controller from '../../../lib/controller';
import {
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE,
    ACTIVE_STATE_IDLE
} from './constants';

class Toolbar extends React.Component {
    static propTypes = {
        port: React.PropTypes.string,
        ready: React.PropTypes.bool,
        activeState: React.PropTypes.string
    };
    state = {
        workflowState: WORKFLOW_STATE_IDLE,
        gcodeFinished: false
    };
    controllerEvents = {
        'gcode:statuschange': (data) => {
            if (data.executed >= data.total) {
                this.setState({ gcodeFinished: true });
            }
        }
    };
    pubsubTokens = [];

    componentDidMount() {
        this.addControllerEvents();
        this.subscribe();
    }
    componentWillUnmount() {
        this.removeControllerEvents();
        this.unsubscribe();
    }
    componentDidUpdate() {
        this.props.setWorkflowState(this.state.workflowState);
    }
    componentWillReceiveProps(nextProps) {
        let { port, activeState } = nextProps;

        if (!port) {
            this.setState({ workflowState: WORKFLOW_STATE_IDLE });
            return;
        }

        if ((this.state.gcodeFinished) && (activeState === ACTIVE_STATE_IDLE)) {
            controller.gcode.stop();
            pubsub.publish('gcode:stop');
            this.setState({
                workflowState: WORKFLOW_STATE_IDLE,
                gcodeFinished: false
            });
        }
    }
    subscribe() {
        { // setWorkflowState
            let token = pubsub.subscribe('setWorkflowState', (msg, workflowState) => {
                this.setState({ workflowState: workflowState });
            });
            this.pubsubTokens.push(token);
        }
    }
    unsubscribe() {
        _.each(this.pubsubTokens, (token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }
    addControllerEvents() {
        _.each(this.controllerEvents, (callback, eventName) => {
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents() {
        _.each(this.controllerEvents, (callback, eventName) => {
            controller.off(eventName, callback);
        });
    }
    handleRun() {
        let { workflowState } = this.state;
        console.assert(_.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATE_PAUSED], workflowState));

        if (workflowState === WORKFLOW_STATE_PAUSED) {
            controller.gcode.resume();
            pubsub.publish('gcode:resume');
        } else {
            controller.gcode.start();
            pubsub.publish('gcode:start');
        }

        this.setState({
            workflowState: WORKFLOW_STATE_RUNNING
        });
    }
    handlePause() {
        let { workflowState } = this.state;
        console.assert(_.includes([WORKFLOW_STATE_RUNNING], workflowState));

        controller.gcode.pause();
        pubsub.publish('gcode:pause');

        this.setState({
            workflowState: WORKFLOW_STATE_PAUSED
        });
    }
    handleStop() {
        let { workflowState } = this.state;
        console.assert(_.includes([WORKFLOW_STATE_PAUSED], workflowState));

        controller.gcode.stop();
        pubsub.publish('gcode:stop');

        this.setState({
            workflowState: WORKFLOW_STATE_IDLE
        });
    }
    handleClose() {
        let { workflowState } = this.state;
        console.assert(_.includes([WORKFLOW_STATE_IDLE], workflowState));

        controller.gcode.unload();

        pubsub.publish('gcode:unload'); // Unload the G-code

        this.setState({
            workflowState: WORKFLOW_STATE_IDLE
        });
    }
    render() {
        let { port, ready } = this.props;
        let { workflowState } = this.state;
        let canClick = !!port && ready;
        let canRun = canClick && _.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATE_PAUSED], workflowState);
        let canPause = canClick && _.includes([WORKFLOW_STATE_RUNNING], workflowState);
        let canStop = canClick && _.includes([WORKFLOW_STATE_PAUSED], workflowState);
        let canClose = canClick && _.includes([WORKFLOW_STATE_IDLE], workflowState);

        return (
            <div className="btn-toolbar" role="toolbar">
                <div className="btn-group btn-group-sm" role="group">
                    <button type="button" className="btn btn-default" title={i18n._('Run')} onClick={::this.handleRun} disabled={!canRun}>
                        <i className="glyphicon glyphicon-play"></i>
                    </button>
                    <button type="button" className="btn btn-default" title={i18n._('Pause')} onClick={::this.handlePause} disabled={!canPause}>
                        <i className="glyphicon glyphicon-pause"></i>
                    </button>
                    <button type="button" className="btn btn-default" title={i18n._('Stop')} onClick={::this.handleStop} disabled={!canStop}>
                        <i className="glyphicon glyphicon-stop"></i>
                    </button>
                    <button type="button" className="btn btn-default" title={i18n._('Close')} onClick={::this.handleClose} disabled={!canClose}>
                        <i className="glyphicon glyphicon-trash"></i>
                    </button>
                </div>
            </div>
        );
    }
}

export default Toolbar;
