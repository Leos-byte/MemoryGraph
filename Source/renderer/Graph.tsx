import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type Connection, type Node, type NodeProps } from '@xyflow/react';
import { CircleCheck, CircleDashed, CircleAlert, Focus, LoaderCircle, Minus, Plus, StopCircle } from 'lucide-react';
import type { NodeRecord, Snapshot } from '../shared/types';
import { statusLabel, type Translate } from './i18n';
import { IconButton } from './ui';

type ConceptNode = Node<{ title: string; status: string; busy: boolean; t: Translate }, 'concept'>;
const Concept = memo(function Concept({ data, selected }: NodeProps<ConceptNode>) {
  const failed = ['error', 'failed'].includes(data.status);
  const cancelled = ['cancelled', 'canceled'].includes(data.status);
  const ready = ['ready', 'complete', 'completed', 'done'].includes(data.status);
  const Icon = data.busy ? LoaderCircle : failed ? CircleAlert : cancelled ? StopCircle : ready ? CircleCheck : CircleDashed;
  return <div className={`concept-node ${selected ? 'is-selected' : ''} ${failed ? 'is-error' : ''}`}>
    <Handle type="target" position={Position.Left} aria-label={data.t('target')} />
    <div className="concept-node-title" data-testid="graph-node-title">{data.title}</div>
    <div className={`concept-node-status ${data.busy ? 'is-busy' : ''}`}><Icon size={12} className={data.busy ? 'spin' : ''} aria-hidden="true" /><span>{data.busy ? data.t('generating') : statusLabel(data.status, data.t)}</span></div>
    <Handle type="source" position={Position.Right} aria-label={data.t('source')} />
  </div>;
});
const nodeTypes = { concept: Concept };

interface GraphProps {
  snapshot: Snapshot; selectedId: string | null; t: Translate;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onConnect: (connection: Connection) => void;
  onContext: (node: NodeRecord, x: number, y: number) => void;
  onBlank: (x: number, y: number) => void;
}

function GraphView({ snapshot, selectedId, t, onSelect, onMove, onConnect, onContext, onBlank }: GraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNode>([]);
  const flow = useReactFlow();
  const rightGesture = useRef({ x: 0, y: 0, moved: false });
  // ReactFlow observes this callback in an effect; keep it stable across selection updates.
  const onSelectionChange = useCallback(({ nodes }: { nodes: ConceptNode[] }) => {
    if (nodes[0]) onSelect(nodes[0].id);
  }, [onSelect]);
  useEffect(() => {
    setNodes(previous => snapshot.nodes.filter(node => !node.deleted_at).map(node => {
      const existing = previous.find(item => item.id === node.id);
      return { id: node.id, type: 'concept', position: existing?.dragging ? existing.position : { x: node.x, y: node.y }, selected: node.id === selectedId, dragging: existing?.dragging,
        ariaLabel: `${node.title}, ${statusLabel(node.status, t)}`, data: { title: node.title, status: node.status, busy: snapshot.busy.includes(node.id) || node.status === 'generating', t } };
    }));
  }, [snapshot.nodes, snapshot.busy, selectedId, t, setNodes]);
  const edges = useMemo(() => snapshot.edges.filter(edge => snapshot.nodes.some(node => node.id === edge.source_node_id) && snapshot.nodes.some(node => node.id === edge.target_node_id)).map(edge => ({
    id: edge.id, source: edge.source_node_id, target: edge.target_node_id, label: edge.label || undefined,
    type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#7d9792' },
    style: { stroke: edge.source_node_id === selectedId || edge.target_node_id === selectedId ? '#168477' : '#a7b7b3', strokeWidth: 1.5 },
    labelStyle: { fill: '#57635f', fontSize: 11 }, labelBgStyle: { fill: '#fff' }, labelBgPadding: [5, 3] as [number, number],
  })), [snapshot.edges, snapshot.nodes, selectedId]);
  return <div className="graph-surface" data-testid="canvas" aria-label={t('graph')} onPointerDownCapture={event => {
    if (event.button === 2) rightGesture.current = { x: event.clientX, y: event.clientY, moved: false };
  }} onPointerMoveCapture={event => {
    if (event.buttons === 2 && Math.hypot(event.clientX - rightGesture.current.x, event.clientY - rightGesture.current.y) > 5) rightGesture.current.moved = true;
  }} onContextMenu={event => event.preventDefault()}>
    <ReactFlow<ConceptNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onSelect(node.id)} onPaneClick={() => onSelect(null)}
      onNodeDragStart={(_, node) => onSelect(node.id)} onNodeDragStop={(_, node) => onMove(node.id, node.position.x, node.position.y)}
      onConnect={onConnect} isValidConnection={connection => connection.source !== connection.target && !snapshot.edges.some(edge => edge.source_node_id === connection.source && edge.target_node_id === connection.target)}
      onNodeContextMenu={(event, node) => { event.preventDefault(); if (rightGesture.current.moved) return; const record = snapshot.nodes.find(item => item.id === node.id); if (record) { onSelect(node.id); onContext(record, event.clientX, event.clientY); } }}
      onPaneContextMenu={event => { event.preventDefault(); if (rightGesture.current.moved || !snapshot.mapId) return; const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }); onBlank(point.x, point.y); }}
      onSelectionChange={onSelectionChange}
      fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.15} maxZoom={2} panOnDrag={[2]} selectionOnDrag={false}
      deleteKeyCode={null} nodesConnectable nodesFocusable edgesFocusable={false} proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d3ddda" />
    </ReactFlow>
    <div className="graph-controls" role="toolbar" aria-label={t('graph')}>
      <IconButton icon={Plus} label={t('zoomIn')} onClick={() => void flow.zoomIn({ duration: 120 })} />
      <IconButton icon={Minus} label={t('zoomOut')} onClick={() => void flow.zoomOut({ duration: 120 })} />
      <span className="control-separator" /><IconButton icon={Focus} label={t('fitView')} onClick={() => void flow.fitView({ padding: 0.3, maxZoom: 1, duration: 150 })} />
    </div>
    {!nodes.length && <div className="canvas-empty" aria-live="polite"><CircleDashed size={28} /><span>{snapshot.mapId ? t('nodesEmpty') : t('selectMap')}</span></div>}
  </div>;
}

export function Graph(props: GraphProps) {
  return <ReactFlowProvider key={props.snapshot.mapId ?? 'empty'}><GraphView {...props} /></ReactFlowProvider>;
}
