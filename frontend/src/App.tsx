// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link, useParams } from 'react-router-dom';
import { Layout, Menu, Button, message, Space, Badge, Card, Descriptions, Input, Table, Tag, Form } from 'antd';
import { UserOutlined, LogoutOutlined, UnorderedListOutlined } from '@ant-design/icons';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const { Header, Content, Footer } = Layout;

// --- APP Configuration ---
const API_PORT = process.env.API_PORT || '3001'
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || '4001'
const API_HOST = process.env.API_HOST || 'localhost'
const WEBSOCKET_HOST = process.env.WEBSOCKET_HOST || 'localhost'
const AUTH_API_URL = `http://${API_HOST}:${API_PORT}/auth`;
const TODO_API_URL = `http://${API_HOST}:${API_PORT}/`;
const WS_SERVER_URL = `ws://${WEBSOCKET_HOST}:${WEBSOCKET_PORT}`;

// --- Helper for API calls ---
const api = axios.create({
  baseURL: TODO_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- JWT Decode Type ---
interface DecodedToken {
  uuid: string;
  email: string;
  iat: number;
  exp: number;
}

// --- OT Client Logic (Simplified for demonstration) ---
// In a real application, consider a robust OT library like ot.js or ShareDB
interface Operation {
  type: 'insert' | 'delete';
  position: number;
  text?: string; // For insert
  length?: number; // For delete
  revision?: number; // Server's revision when this op was generated
}

class OTClient {
  private ws: WebSocket | null = null;
  private document: string = '';
  private revision: number = 0; // Client's current document revision
  private pendingOps: Operation[] = []; // Operations sent but not yet acknowledged by server
  private onUpdate: (newDoc: string) => void;
  private onConnect: () => void;
  private onDisconnect: () => void;
  private onError: (error: Event) => void;
  private userId: string = ''; // User UUID for OT operations

  constructor(
    onUpdate: (newDoc: string) => void,
    onConnect: () => void,
    onDisconnect: () => void,
    onError: (error: Event) => void
  ) {
    this.onUpdate = onUpdate;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.onError = onError;
  }

  private transform(opA: Operation, opB: Operation): [Operation, Operation] {
    let newOpA = { ...opA };
    let newOpB = { ...opB };

    // Case 1: opA is Insert, opB is Insert
    if (opA.type === 'insert' && opB.type === 'insert') {
      if (opA.position < opB.position) {
        newOpB.position += (opA.text?.length || 0);
      } else if (opB.position < opA.position) {
        newOpA.position += (opB.text?.length || 0);
      } else { // opA.position === opB.position
        // Tie-breaking rule: if positions are equal, the remote op (opB) shifts after local (opA)
        // This is a common tie-breaking rule to ensure deterministic outcomes.
        newOpB.position += (opA.text?.length || 0);
      }
    }
    // Case 2: opA is Delete, opB is Insert
    else if (opA.type === 'delete' && opB.type === 'insert') {
      // If opA's deletion range affects opB's insertion position
      if (opA.position <= opB.position) {
        newOpB.position -= Math.min(opB.position - opA.position, opA.length || 0);
      }
      // If opB's insertion position is within opA's deletion range, opB is effectively deleted.
      // This simplified transform doesn't nullify ops, just adjusts positions.
      if (newOpB.position < 0) newOpB.position = 0;
    }
    // Case 3: opA is Insert, opB is Delete
    else if (opA.type === 'insert' && opB.type === 'delete') {
      // If opB's deletion range affects opA's insertion position
      if (opB.position <= opA.position) {
        newOpA.position -= Math.min(opA.position - opB.position, opB.length || 0);
      }
      // If opA's insertion point is within opB's deletion range, opA effectively gets deleted.
      // This simplified transform doesn't nullify ops, just adjusts positions.
      if (newOpA.position < 0) newOpA.position = 0;
    }
    // Case 4: Both are Deletes
    else if (opA.type === 'delete' && opB.type === 'delete') {
      // Adjust positions
      if (opA.position < opB.position) {
        newOpB.position -= Math.min(opB.position - opA.position, opA.length || 0);
      } else if (opB.position < opA.position) {
        newOpA.position -= Math.min(opA.position - opB.position, opB.length || 0);
      }

      // Handle overlapping deletions (most complex part for deletes):
      // If opA deletes content that opB also deletes, opB's length might need to be reduced.
      // If opB deletes content that opA also deletes, opA's length might need to be reduced.
      // This simplified transform focuses on position adjustment.
      // A robust OT would handle splitting/merging operations or nullifying them if fully consumed.

      // Example of handling overlap for length (still simplified):
      // Calculate overlap start and end
      const opA_start = opA.position;
      const opA_end = opA.position + (opA.length || 0);
      const opB_start = opB.position;
      const opB_end = opB.position + (opB.length || 0);

      const overlap_start = Math.max(opA_start, opB_start);
      const overlap_end = Math.min(opA_end, opB_end);
      const overlap_length = Math.max(0, overlap_end - overlap_start);

      if (overlap_length > 0) {
        // If opA starts before opB, and they overlap, opB's effective length is reduced
        // by the part of opA that overlaps with opB's start.
        if (opA.position < opB.position) {
          newOpB.length = Math.max(0, (opB.length || 0) - overlap_length);
        }
        // If opB starts before opA, and they overlap, opA's effective length is reduced
        // by the part of opB that overlaps with opA's start.
        else if (opB.position < opA.position) {
          newOpA.length = Math.max(0, (opA.length || 0) - overlap_length);
        }
        // If they start at the same position, a tie-breaking rule is needed.
        // For simplicity, we assume the remote op (opB) gets priority in consuming the overlap.
        else { // opA.position === opB.position
          newOpB.length = Math.max(0, (opB.length || 0) - (opA.length || 0));
          newOpA.length = 0; // opA is consumed by opB if they start at same place
        }
      }

      // Ensure positions are not negative
      if (newOpA.position < 0) newOpA.position = 0;
      if (newOpB.position < 0) newOpB.position = 0;
    }

    return [newOpA, newOpB];
  }


  connect(todoUuid: string, accessToken: string, userId: string) {
    if (this.ws) {
      this.ws.close();
    }
    this.userId = userId;
    // Pass JWT in query params for WS authentication
    this.ws = new WebSocket(`${WS_SERVER_URL}/todo-description?token=${accessToken}&todoUuid=${todoUuid}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.onConnect();
      // On connect, request initial document state and revision
      this.ws?.send(JSON.stringify({ type: 'get_document' }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string);
      console.log('Received WS data:', data);

      if (data.type === 'document_state') {
        // Initial document state received
        this.document = data.document;
        this.revision = data.revision;
        this.onUpdate(this.document);
        // Clear pending ops as we've synced to server's latest state
        this.pendingOps = [];
      } else if (data.type === 'operation') {
        const remoteOp: Operation = data.operation;
        const remoteRevision = data.revision;

        // --- START OF IMPLEMENTED OT CLIENT-SIDE TRANSFORMATION ---
        // This is a simplified OT implementation. A full OT library would be more robust.

        // 1. Filter out acknowledged pending operations
        // A real OT would match by opId, but for this demo, we assume the first pending op
        // is the one acknowledged if its revision matches the remote op's revision.
        // This part needs to be careful if multiple ops are sent quickly and acknowledged out of order.
        // For a robust system, each sent op should have a unique ID, and acknowledgment should clear by ID.
        // For this demo, we assume FIFO acknowledgment.
        let acknowledged = false;
        if (this.pendingOps.length > 0 && this.pendingOps[0].revision === remoteOp.revision) {
            this.pendingOps.shift(); // Remove the acknowledged operation
            acknowledged = true;
        }

        let transformedRemoteOp = { ...remoteOp };
        let newPendingOps: Operation[] = [];

        // Transform remoteOp against all remaining pendingOps
        // And transform each localOp against the original remoteOp
        for (const localOp of this.pendingOps) {
          // Perform transformation: [transformedLocalOp, transformedRemoteOp] = transform(localOp, remoteOp)
          const [transformedLocal, transformedRemote] = this.transform(localOp, transformedRemoteOp);
          transformedRemoteOp = transformedRemote; // Update remote op for next transformation
          newPendingOps.push(transformedLocal); // Add transformed local op to new pending list
        }
        this.pendingOps = newPendingOps; // Update pending ops with transformed versions

        // --- END OF IMPLEMENTED OT CLIENT-SIDE TRANSFORMATION ---


        // 2. Apply the (potentially transformed) remote operation to the local document
        this.document = this.applyOperation(this.document, transformedRemoteOp);
        this.revision = remoteRevision; // Update client's revision to server's latest

        // 3. Re-apply pending local operations
        // These are the local operations that were transformed in step 1.
        let tempDoc = this.document;
        for (const op of this.pendingOps) { // Use the updated this.pendingOps
            tempDoc = this.applyOperation(tempDoc, op);
        }
        this.document = tempDoc;

        this.onUpdate(this.document);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.onDisconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onError(error);
    };
  }
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Simplified diffing and sending operation
  sendOperation(oldDoc: string, newDoc: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open. Cannot send operation.');
      return;
    }

    const ops: Operation[] = [];
    // Basic diffing: find first difference
    let firstDiff = -1;
    for (let i = 0; i < Math.min(oldDoc.length, newDoc.length); i++) {
      if (oldDoc[i] !== newDoc[i]) {
        firstDiff = i;
        break;
      }
    }

    if (firstDiff === -1) {
      if (oldDoc.length < newDoc.length) { // Insert at end
        firstDiff = oldDoc.length;
      } else if (oldDoc.length > newDoc.length) { // Delete at end
        firstDiff = newDoc.length;
      } else { // No change
        return;
      }
    }

    const oldSuffixStart = oldDoc.length - (oldDoc.length - firstDiff);
    const newSuffixStart = newDoc.length - (newDoc.length - firstDiff);

    let commonSuffixLength = 0;
    while (
      oldSuffixStart - commonSuffixLength >= 0 &&
      newSuffixStart - commonSuffixLength >= 0 &&
      oldDoc[oldDoc.length - 1 - commonSuffixLength] === newDoc[newDoc.length - 1 - commonSuffixLength]
    ) {
      commonSuffixLength++;
    }

    const oldMiddle = oldDoc.substring(firstDiff, oldDoc.length - commonSuffixLength);
    const newMiddle = newDoc.substring(firstDiff, newDoc.length - commonSuffixLength);

    if (oldMiddle.length > 0) {
      ops.push({ type: 'delete', position: firstDiff, length: oldMiddle.length });
    }
    if (newMiddle.length > 0) {
      ops.push({ type: 'insert', position: firstDiff, text: newMiddle });
    }

    if (ops.length === 0) return; // No actual change

    // For simplicity, we'll send the first detected op.
    const opToSend = ops[0];
    opToSend.revision = this.revision; // Send client's current revision

    console.log(JSON.stringify({ type: 'operation', operation: opToSend, userId: this.userId }))

    this.ws.send(JSON.stringify({ type: 'operation', operation: opToSend, userId: this.userId }));
    this.pendingOps.push(opToSend); // Add to pending ops
    this.document = newDoc; // Update local document immediately
  }

  // Applies an operation to a document string
  private applyOperation(doc: string, op: Operation): string {
    if (op.type === 'insert' && op.text !== undefined) {
      return doc.slice(0, op.position) + op.text + doc.slice(op.position);
    } else if (op.type === 'delete' && op.length !== undefined) {
      return doc.slice(0, op.position) + doc.slice(op.position + op.length);
    }
    return doc; // No change or invalid op
  }
}


// --- PrivateRoute Component ---
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('accessToken');
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};


const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    try {
      const response = await axios.post(`${AUTH_API_URL}/login`, values);
      localStorage.setItem('accessToken', response.data.accessToken);
      message.success('Login successful!');
      navigate('/todos');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Login failed.');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Card title="Login" style={{ width: 400 }}>
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Please input your email!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Layout>
  );
};


interface TodoListItem {
  uuid: string;
  name: string;
  // Add other fields if needed, but requirements only ask for name and uuid here
}

const TodoListPage: React.FC = () => {
  const [todos, setTodos] = useState<TodoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodos = async () => {
      try {
        setLoading(true);
        const response = await api.get('/todos');
        setTodos(response.data.data); // Assuming response.data is { data: [], total: ... }
      } catch (error: any) {
        message.error(error.response?.data?.message || 'Failed to fetch todos.');
      } finally {
        setLoading(false);
      }
    };
    fetchTodos();
  }, []);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: TodoListItem) => (
        <Space size="middle">
          <Link to={`/todo/${record.uuid}`}>View Detail</Link>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Card title="Your Todo List" style={{ marginBottom: 20 }}>
          <Table dataSource={todos} columns={columns} rowKey="uuid" loading={loading} />
        </Card>
      </Content>
    </Layout>
  );
};


interface TodoDetail {
  uuid: string;
  name: string;
  description: string;
  status: string;
  dueDate: string; // ISO string
  priority: string;
  tags?: string[];
  // Assuming the API returns the user's role for this todo
  userRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
}

const TodoDetailPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [todo, setTodo] = useState<TodoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const otClientRef = React.useRef<OTClient | null>(null);
  const isEditingAllowed = todo?.userRole === 'OWNER' || todo?.userRole === 'EDITOR';

  useEffect(() => {
    const fetchTodoDetails = async () => {
      try {
        setLoading(true);
        // Request all fields for the detail view
        const response = await api.get(`/todo/${uuid}?fields=name,description,status,dueDate,priority,tags`);
        const fetchedTodo: TodoDetail = response.data;
        setTodo(fetchedTodo);
        setDescription(fetchedTodo.description || ''); // Initialize description from fetched data

        // Fetch user's role for this specific todo
        const userTodoResponse = await api.get(`/todo/${uuid}/user-role`);
        fetchedTodo.userRole = userTodoResponse.data.role;
        setTodo(fetchedTodo); // Update todo state with role

        // Initialize OT Client and connect WebSocket
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          const decodedToken: DecodedToken = jwtDecode(accessToken);
          const userUuid = decodedToken.uuid;
          
          otClientRef.current = new OTClient(
            (newDoc) => setDescription(newDoc),
            () => setWsStatus('connected'),
            () => setWsStatus('disconnected'),
            () => setWsStatus('error')
          );
          otClientRef.current.connect(uuid!, accessToken, userUuid);
        } else {
          message.error('Authentication token not found.');
          setWsStatus('error');
        }

      } catch (error: any) {
        message.error(error.response?.data?.message || 'Failed to fetch todo details.');
        setWsStatus('error');
      } finally {
        setLoading(false);
      }
    };

    if (uuid) {
      fetchTodoDetails();
    }

    // Cleanup WebSocket on unmount
    return () => {
      if (otClientRef.current) {
        otClientRef.current.disconnect();
      }
    };
  }, [uuid]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const oldDoc = description;
    const newDoc = e.target.value;
    setDescription(newDoc); // Update local state immediately
    if (otClientRef.current && isEditingAllowed) {
      otClientRef.current.sendOperation(oldDoc, newDoc);
    }
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Loading todo details...</p>
      </Layout>
    );
  }

  if (!todo) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Todo not found.</p>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Card title={`Todo: ${todo.name}`} style={{ marginBottom: 20 }}>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="UUID">{todo.uuid}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge status={todo.status === 'COMPLETED' ? 'success' : 'processing'} text={todo.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Priority">
              <Tag color={todo.priority === 'HIGH' ? 'red' : todo.priority === 'MEDIUM' ? 'orange' : 'blue'}>
                {todo.priority}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Due Date">{todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Tags">
              {todo.tags && todo.tags.length > 0 ? (
                todo.tags.map((tag, index) => <Tag key={index}>{tag}</Tag>)
              ) : (
                'No Tags'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Your Role">
              <Tag color={todo.userRole === 'OWNER' ? 'purple' : todo.userRole === 'EDITOR' ? 'green' : 'blue'}>
                {todo.userRole}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 20 }}>
            <h3>Description:</h3>
            <Input.TextArea
              value={description}
              onChange={handleDescriptionChange}
              rows={8}
              readOnly={!isEditingAllowed}
              placeholder={isEditingAllowed ? "Start typing to edit description..." : "You can only view this description."}
              style={{ backgroundColor: !isEditingAllowed ? '#f0f0f0' : 'white' }}
            />
            <div style={{ marginTop: 10, fontSize: '0.8em', color: '#888' }}>
              WebSocket Status: <Tag color={wsStatus === 'connected' ? 'green' : 'red'}>{wsStatus}</Tag>
              {!isEditingAllowed && <span style={{ marginLeft: 10, color: 'red' }}> (Read-Only Mode)</span>}
            </div>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('accessToken');

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    message.info('Logged out.');
    navigate('/login');
  };

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header>
        <div className="logo" />
        <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['1']}>
          <Menu.Item key="1" icon={<UnorderedListOutlined />} onClick={() => navigate('/todos')}>
            Todos
          </Menu.Item>
          {isAuthenticated ? (
            <Menu.Item key="2" icon={<LogoutOutlined />} onClick={handleLogout} style={{ float: 'right' }}>
              Logout
            </Menu.Item>
          ) : (
            <Menu.Item key="3" icon={<UserOutlined />} onClick={() => navigate('/login')} style={{ float: 'right' }}>
              Login
            </Menu.Item>
          )}
        </Menu>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content" style={{ background: '#fff', padding: 24, minHeight: 280 }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/todos" element={<PrivateRoute><TodoListPage /></PrivateRoute>} />
            <Route path="/todo/:uuid" element={<PrivateRoute><TodoDetailPage /></PrivateRoute>} />
            <Route path="/" element={<Navigate to="/todos" />} />
          </Routes>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Collaborative Todo App ©2025 Created by Gemini</Footer>
    </Layout>
  );
};


// For Canvas environment, wrap App in Router and export default
export default function MainApp() {
  return (
    <Router>
      <App />
    </Router>
  );
}

